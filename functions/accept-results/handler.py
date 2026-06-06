"""accept-results Lambda — receives inference results from GCP via API Gateway.

Validates the X-Callback-Secret header (HMAC), then writes the inference tags
and status to DynamoDB for the given file_id.

Symmetric with GCP's accept-inference Cloud Function (functions/accept-inference/main.py):
  - Same shared secret (prod/gcp/callback-secret in AWS Secrets Manager)
  - Same hmac.compare_digest validation
  - Exposed as POST /inference-results with authorization_type = "NONE" (no JWT)

Environment variables:
  DYNAMODB_TABLE_NAME   — DynamoDB table name (aws_dynamodb_table.media_files)
  CALLBACK_SECRET_ARN   — ARN of the callback secret in AWS Secrets Manager
  REGION_NAME           — AWS region (default: ap-southeast-4)

The secret is fetched from Secrets Manager once at cold start and cached for
the warm lifetime, keeping it out of Lambda environment variables (plaintext
in Terraform state) while remaining cheap (~1 ms per cold start).
"""

from __future__ import annotations

import datetime
import hmac
import json
import logging
import os
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

REGION_NAME         = os.environ.get("REGION_NAME", "ap-southeast-4")
DYNAMODB_TABLE_NAME = os.environ["DYNAMODB_TABLE_NAME"]
CALLBACK_SECRET_ARN = os.environ["CALLBACK_SECRET_ARN"]

dynamodb = boto3.resource("dynamodb", region_name=REGION_NAME)
table    = dynamodb.Table(DYNAMODB_TABLE_NAME)
sm       = boto3.client("secretsmanager", region_name=REGION_NAME)

# Module-level cache — populated on first cold start, reused on warm invocations.
_CALLBACK_SECRET: str = ""


def _get_secret() -> str:
    """Fetch and cache the callback secret from AWS Secrets Manager."""
    global _CALLBACK_SECRET
    if not _CALLBACK_SECRET:
        resp = sm.get_secret_value(SecretId=CALLBACK_SECRET_ARN)
        _CALLBACK_SECRET = resp["SecretString"]
        logger.info("Callback secret loaded from Secrets Manager")
    return _CALLBACK_SECRET


def _unauthorized(msg: str = "Unauthorized") -> dict:
    return {
        "statusCode": 401,
        "body": json.dumps({"error": msg}),
        "headers": {"Content-Type": "application/json"},
    }


def _bad_request(msg: str) -> dict:
    return {
        "statusCode": 400,
        "body": json.dumps({"error": msg}),
        "headers": {"Content-Type": "application/json"},
    }


def _server_error(msg: str) -> dict:
    return {
        "statusCode": 500,
        "body": json.dumps({"error": msg}),
        "headers": {"Content-Type": "application/json"},
    }


def _flatten_result(result: list) -> dict:
    """Flatten [{"koala": 3}, {"magpie": 1}] → {"koala": Decimal(3), "magpie": Decimal(1)}.

    Mirrors the tag-flattening logic in functions/update-file-tags/handler.py.
    Unknown shapes are skipped with a warning.
    """
    tag_map: dict[str, Decimal] = {}
    for entry in result:
        if not isinstance(entry, dict):
            logger.warning("Skipping non-dict result entry: %r", entry)
            continue
        for species, count in entry.items():
            try:
                tag_map[str(species)] = Decimal(int(count))
            except (TypeError, ValueError):
                logger.warning("Skipping invalid count for species %r: %r", species, count)
    return tag_map


def handle(event, context):
    logger.info("Received inference result callback")

    # ── 1. HMAC auth ──────────────────────────────────────────
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    presented = headers.get("x-callback-secret", "")

    try:
        expected = _get_secret()
    except ClientError as exc:
        logger.error("Failed to load callback secret: %s", exc)
        return _server_error("Server misconfigured")

    if not expected:
        logger.error("Callback secret is empty — rejecting request")
        return _server_error("Server misconfigured")

    if not hmac.compare_digest(presented, expected):
        logger.warning("Invalid or missing X-Callback-Secret header")
        return _unauthorized()

    # ── 2. Parse body ─────────────────────────────────────────
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse request body: %s", exc)
        return _bad_request("Invalid JSON body")

    file_id  = body.get("file_id")
    result   = body.get("result") or []
    file_type = body.get("file_type", "image")
    job_type = body.get("job_type", "permanent")

    if not file_id or not isinstance(file_id, str):
        return _bad_request("Missing or invalid file_id")

    logger.info(
        "Processing inference result: file_id=%s file_type=%s job_type=%s tags_count=%d",
        file_id, file_type, job_type, len(result),
    )

    # ── 3. Temporary jobs: no DynamoDB row, just ack ──────────
    if job_type == "temporary":
        logger.info(
            "Temporary job result for file_id=%s — not persisted: %s", file_id, result
        )
        return {
            "statusCode": 200,
            "body": json.dumps({"status": "ack", "file_id": file_id}),
            "headers": {"Content-Type": "application/json"},
        }

    # ── 4. Flatten result → DynamoDB-compatible map ───────────
    tag_map = _flatten_result(result)
    completed_at = datetime.datetime.utcnow().isoformat() + "Z"

    # ── 5. Write to DynamoDB ──────────────────────────────────
    try:
        table.update_item(
            Key={"file_id": file_id},
            UpdateExpression=(
                "SET tags = :t, "
                "inference_status = :s, "
                "inference_completed_at = :ts"
            ),
            ExpressionAttributeValues={
                ":t":  tag_map,
                ":s":  "completed",
                ":ts": completed_at,
            },
            # Guard: only update rows that exist (don't create phantom records)
            ConditionExpression="attribute_exists(file_id)",
        )
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        logger.warning("No DynamoDB row for file_id=%s — cannot store result", file_id)
        return {
            "statusCode": 404,
            "body": json.dumps({"error": "unknown file_id", "file_id": file_id}),
            "headers": {"Content-Type": "application/json"},
        }
    except ClientError as exc:
        logger.error("DynamoDB UpdateItem failed for file_id=%s: %s", file_id, exc)
        # Return 500 → GCP processor retries via its in-process backoff loop
        return _server_error(f"DynamoDB update failed: {exc.response['Error']['Code']}")

    logger.info(
        "Stored inference result for file_id=%s species=%s completed_at=%s",
        file_id,
        list(tag_map.keys()),
        completed_at,
    )
    return {
        "statusCode": 200,
        "body": json.dumps({"status": "stored", "file_id": file_id}),
        "headers": {"Content-Type": "application/json"},
    }
