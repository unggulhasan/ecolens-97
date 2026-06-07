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

from urllib.parse import urlparse
from botocore.config import Config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TMP_DYNAMODB_TABLE_NAME = os.environ["TMP_DYNAMODB_TABLE_NAME"]
CALLBACK_SECRET_ARN = os.environ["CALLBACK_SECRET_ARN"]
REGION_NAME              = os.environ.get("REGION_NAME", "ap-southeast-4")
DYNAMODB_TABLE_NAME      = os.environ["DYNAMODB_TABLE_NAME"]
CALLBACK_SECRET_ARN      = os.environ["CALLBACK_SECRET_ARN"]
SUBSCRIPTIONS_TABLE_NAME = os.environ.get("SUBSCRIPTIONS_TABLE_NAME")
NOTIFICATIONS_TABLE_NAME = os.environ.get("NOTIFICATIONS_TABLE_NAME")
SNS_TOPIC_ARN            = os.environ.get("SNS_TOPIC_ARN")

dynamodb = boto3.resource("dynamodb", region_name=REGION_NAME)
table    = dynamodb.Table(DYNAMODB_TABLE_NAME)
tmp_table   = dynamodb.Table(TMP_DYNAMODB_TABLE_NAME)
sm       = boto3.client("secretsmanager", region_name=REGION_NAME)

s3 = boto3.client(
    "s3",
    region_name=REGION_NAME,
    endpoint_url=f"https://s3.{REGION_NAME}.amazonaws.com",
    config=Config(signature_version="s3v4"),
)

sm = boto3.client("secretsmanager", region_name=REGION_NAME)

PRESIGN_EXPIRY = 3600


# Module-level cache — populated on first cold start, reused on warm invocations.
_CALLBACK_SECRET: str = ""


def _generate_presigned_get(thumbnail_url: str) -> str | None:
    """Generate a 1-hour presigned GET URL for an S3 thumbnail."""
    try:
        bucket, key = _parse_s3_url(thumbnail_url)
        return s3.generate_presigned_url(
            ClientMethod='get_object',
            Params={'Bucket': bucket, 'Key': key},
            ExpiresIn=PRESIGN_EXPIRY,
        )
    except Exception as e:
        print(f"Warning: Failed to generate presigned URL for {thumbnail_url}: {e}")
        return None
    
def _parse_s3_url(s3_url: str) -> tuple[str, str]:
    """Parse s3://bucket/key into (bucket, key)."""
    parsed = urlparse(s3_url)
    if parsed.scheme != 's3':
        raise ValueError(f"Expected s3:// URL, got: {s3_url}")
    bucket = parsed.netloc
    key = parsed.path.lstrip('/')
    return bucket, key

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

def _find_matching_media(tag_map: dict, limit: int = 20) -> tuple[list, list]:
    """Find media rows that contain all tags returned by GCP.

    Returns:
        media_urls: presigned URLs for matched media files
        thumbnail_urls: presigned URLs for matched thumbnails
    """
    media_urls = []
    thumbnail_urls = []

    required_tags = set(tag_map.keys())

    if not required_tags:
        return media_urls, thumbnail_urls

    response = table.scan()
    items = response.get("Items", [])

    for item in items:
        db_tags = item.get("tags") or {}

        if not isinstance(db_tags, dict):
            continue

        db_tag_names = set(db_tags.keys())

        # Only match rows that contain ALL tags returned by GCP.
        if not required_tags.issubset(db_tag_names):
            continue

        file_s3_url = item.get("file_url")
        thumbnail_s3_url = item.get("thumbnail_url")

        presigned_file_url = _generate_presigned_get(file_s3_url)
        presigned_thumbnail_url = _generate_presigned_get(thumbnail_s3_url)

        if presigned_file_url:
            media_urls.append(presigned_file_url)
            thumbnail_urls.append(presigned_thumbnail_url)

        if len(media_urls) >= limit:
            break

    return media_urls, thumbnail_urls

def _trigger_notifications(file_id: str, url: str, uploaded_at: str, newly_added_tags: list[str]) -> None:
    """Publish SNS alerts and write notifications to DynamoDB for matched subscriptions."""
    if not newly_added_tags:
        return

    # 1. Retrieve all subscriptions if database or SNS notifications are enabled
    subs = []
    if SUBSCRIPTIONS_TABLE_NAME:
        try:
            subscriptions_table = dynamodb.Table(SUBSCRIPTIONS_TABLE_NAME)
            response = subscriptions_table.scan()
            subs = response.get("Items", [])
            while "LastEvaluatedKey" in response:
                response = subscriptions_table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
                subs.extend(response.get("Items", []))
        except Exception as scan_err:
            logger.error("Failed to scan subscriptions: %s", str(scan_err))

    # 2. For each newly added tag, process notifications
    for tag in newly_added_tags:
        normalized_tag = tag.strip().lower()

        # Find subscription tags that are substrings of the newly added tag
        matching_sub_tags = []
        for sub in subs:
            sub_tags = sub.get("tags", [])
            for sub_tag in sub_tags:
                normalized_sub_tag = sub_tag.strip().lower()
                if normalized_sub_tag in normalized_tag:
                    matching_sub_tags.append(normalized_sub_tag)

        # Deduplicate and include the actual tag itself
        matched_policy_tags = list(set([normalized_tag] + matching_sub_tags))

        # Publish to SNS
        if SNS_TOPIC_ARN:
            try:
                sns = boto3.client("sns", region_name=REGION_NAME)
                message_body = (
                    f"Notification: A new wildlife file has been tagged in Aussie Ecolens!\n\n"
                    f"Species Tag: {normalized_tag}\n"
                    f"File URL: {url}\n"
                    f"Timestamp: {uploaded_at}\n\n"
                    f"Log in to the system to search and view the full file."
                )
                subject = f"Aussie Ecolens: New {normalized_tag} file uploaded"

                logger.info("Publishing alert to SNS for tag: %s (matched filter tags: %s)", normalized_tag, matched_policy_tags)
                sns.publish(
                    TopicArn=SNS_TOPIC_ARN,
                    Message=message_body,
                    Subject=subject,
                    MessageAttributes={
                        "tag": {
                            "DataType": "String.Array",
                            "StringValue": json.dumps(matched_policy_tags)
                        }
                    }
                )
            except Exception as e:
                logger.error("Failed to publish SNS notifications for tag %s: %s", normalized_tag, str(e))

        # 3. Create database notification records for users who subscribed to a matching tag
        if NOTIFICATIONS_TABLE_NAME:
            try:
                notifications_table = dynamodb.Table(NOTIFICATIONS_TABLE_NAME)
                import uuid
                import datetime

                for sub in subs:
                    user_id = sub.get("user_id")
                    sub_tags = sub.get("tags", [])

                    if not user_id or not sub_tags:
                        continue

                    # Find if any subscription tag is a substring of the newly added tag
                    user_matching_tags = [
                        st.strip().lower() for st in sub_tags
                        if st.strip().lower() in normalized_tag
                    ]

                    if user_matching_tags:
                        for matching_tag in user_matching_tags:
                            notif_id = f"{datetime.datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}#{uuid.uuid4().hex[:8]}"
                            timestamp = datetime.datetime.utcnow().isoformat() + "Z"

                            title = f"Wildlife Detected: {matching_tag.capitalize()}"
                            message = f"A new file containing \"{matching_tag}\" has been tagged in Aussie Ecolens."

                            notifications_table.put_item(
                                Item={
                                    "user_id": user_id,
                                    "notification_id": notif_id,
                                    "title": title,
                                    "message": message,
                                    "read": False,
                                    "timestamp": timestamp,
                                    "file_url": url,
                                    "tag": matching_tag
                                }
                            )
                            logger.info("Saved notification for user %s, tag: %s (matching tag: %s)", user_id, normalized_tag, matching_tag)
            except Exception as db_err:
                logger.error("Failed to save database notifications for tag %s: %s", normalized_tag, str(db_err))


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
        tag_map = _flatten_result(result)

        try:
            # 1. Find the existing temp row first
            existing_temp_row = tmp_table.get_item(
                Key={"file_id": file_id}
            ).get("Item")

            if not existing_temp_row:
                logger.warning(
                    "No temporary query row found for file_id=%s — cannot update result",
                    file_id,
                )
                return {
                    "statusCode": 404,
                    "body": json.dumps({
                        "error": "unknown temporary file_id",
                        "file_id": file_id,
                    }),
                    "headers": {"Content-Type": "application/json"},
                }

            # 2. Only query main table if GCP returned tags
            if tag_map:
                media_urls, thumbnail_urls = _find_matching_media(tag_map)
            else:
                media_urls, thumbnail_urls = [], []

            # 3. is_found is true only when matching media was found
            is_found = len(media_urls) > 0

            # 4. Update existing temp row
            tmp_table.update_item(
                Key={"file_id": file_id},
                UpdateExpression=(
                    "SET file_type = :ft, "
                    "tags = :t, "
                    "#st = :s, "
                    "media_url = :mu, "
                    "thumbnail_url = :tu, "
                    "is_found = :f"
                ),
                ExpressionAttributeNames={
                    "#st": "status",
                },
                ExpressionAttributeValues={
                    ":ft": file_type,
                    ":t": tag_map,
                    ":s": "completed",
                    ":mu": media_urls,
                    ":tu": thumbnail_urls,
                    ":f": is_found,
                },
            )

        except ClientError as exc:
            logger.error(
                "Temporary result processing failed for file_id=%s: %s",
                file_id,
                exc,
            )
            return _server_error(
                f"Temporary result processing failed: {exc.response['Error']['Code']}"
            )

        logger.info(
            "Updated temporary query row for file_id=%s is_found=%s matches_count=%d",
            file_id,
            is_found,
            len(media_urls),
        )

        return {
            "statusCode": 200,
            "body": json.dumps({
                "status": "stored_temp",
                "file_id": file_id,
                "is_found": is_found,
                "matches_count": len(media_urls),
            }),
            "headers": {"Content-Type": "application/json"},
        }

    # ── 4. Flatten result → DynamoDB-compatible map ───────────
    tag_map = _flatten_result(result)
    completed_at = datetime.datetime.utcnow().isoformat() + "Z"

    # ── 5. Fetch existing item to check existence and retrieve metadata ──
    try:
        response = table.get_item(Key={"file_id": file_id})
        item = response.get("Item")
    except ClientError as exc:
        logger.error("DynamoDB GetItem failed for file_id=%s: %s", file_id, exc)
        return _server_error(f"DynamoDB get failed: {exc.response['Error']['Code']}")

    if not item:
        logger.warning("No DynamoDB row for file_id=%s — cannot store result", file_id)
        return {
            "statusCode": 404,
            "body": json.dumps({"error": "unknown file_id", "file_id": file_id}),
            "headers": {"Content-Type": "application/json"},
        }

    url = item.get("file_url", "")
    uploaded_at = item.get("uploaded_at", "unknown")

    # ── 6. Write to DynamoDB ──────────────────────────────────
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

    # ── 7. Publish notifications for matching tags ────────────
    _trigger_notifications(file_id, url, uploaded_at, list(tag_map.keys()))

    return {
        "statusCode": 200,
        "body": json.dumps({"status": "stored", "file_id": file_id}),
        "headers": {"Content-Type": "application/json"},
    }
