"""on-tmp-uploaded Lambda — triggered by S3 Object Created on tmp/images/ and tmp/videos/.

Lightweight handler (no OpenCV, pure stdlib + boto3):
  1. Reads checksum and user-email from S3 object metadata.
  2. Derives file_type from the key prefix (images → "image", videos → "video").
  3. Emits a MetadataCreated event directly to EventBridge with job_type="temporary".

Does NOT create a thumbnail or write a DynamoDB record — those steps are only
for permanent uploads handled by on-media-uploaded → on-thumbnail-created.
"""

import json
import logging
import os
import urllib.parse

import boto3
import botocore.exceptions
from botocore.config import Config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
MEDIA_BUCKET_NAME: str = os.environ["MEDIA_BUCKET_NAME"]
REGION_NAME: str | None = os.environ.get("REGION_NAME")
EVENT_BUS_NAME: str = os.environ.get("EVENT_BUS_NAME", "default")
TMP_TABLE_NAME: str = os.environ.get("TMP_TABLE_NAME", "tmp_query")

# ---------------------------------------------------------------------------
# AWS clients
# ---------------------------------------------------------------------------
_config = Config(retries={"max_attempts": 5, "mode": "adaptive"})
s3 = boto3.client("s3", region_name=REGION_NAME, config=_config)
events = boto3.client("events", region_name=REGION_NAME)
dynamodb = boto3.resource("dynamodb", region_name=REGION_NAME, config=_config)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _canonical_parts(key: str) -> tuple[str, str, str]:
    """Return (media_type, file_id, filename) regardless of tmp/ prefix.

    Handles:
      tmp/images/{file_id}/{filename}
      tmp/videos/{file_id}/{filename}
    """
    parts = key.split("/")
    if parts[0] == "tmp":
        parts = parts[1:]
    media_type = parts[0] if parts else "unknown"
    file_id = parts[1] if len(parts) >= 2 else "unknown"
    filename = parts[-1] if parts else "unknown"
    return media_type, file_id, filename


def _get_metadata(bucket: str, key: str) -> tuple[str, str]:
    """Return (checksum, user_id) from S3 object metadata/checksum header."""
    try:
        head = s3.head_object(Bucket=bucket, Key=key, ChecksumMode="ENABLED")
        checksum = head.get("ChecksumSHA256", "")
        user_id = head.get("Metadata", {}).get("user-email", "")
        return checksum, user_id
    except botocore.exceptions.ClientError as exc:
        logger.warning("Could not read metadata for s3://%s/%s: %s", bucket, key, exc)
        return "", ""


def _emit_metadata_created(
    source_key: str,
    file_id: str,
    checksum: str,
    file_type: str,
) -> None:
    """Emit MetadataCreated event to EventBridge with job_type='temporary'."""
    detail = {
        "file_id": file_id,
        "source_key": source_key,
        "checksum": checksum,
        "thumbnail_key": "",
        "file_type": file_type,
        "job_type": "temporary",
    }
    try:
        events.put_events(
            Entries=[
                {
                    "Source": "ecolens.metadata.created",
                    "DetailType": "MetadataCreated",
                    "Detail": json.dumps(detail),
                    "EventBusName": EVENT_BUS_NAME,
                }
            ]
        )
        logger.info(
            "Emitted MetadataCreated for file_id=%s file_type=%s job_type=temporary",
            file_id,
            file_type,
        )
    except Exception as exc:
        logger.error("Failed to emit MetadataCreated: %s", exc)
        raise

def _write_tmp_record(file_id: str, file_type: str, checksum: str) -> None:
    """Write initial processing record to tmp_query table."""
    table = dynamodb.Table(TMP_TABLE_NAME)
    try:
        table.put_item(Item={
            "file_id": file_id,
            "file_type": file_type,
            "checksum": checksum,
            "status": "processing",
            "tags": {},
            "thumbnail_urls": [],
            "media_urls": [],
            "is_found": False,
        })
        logger.info("Written tmp_query record for file_id=%s status=processing", file_id)
    except Exception as exc:
        logger.error("Failed to write tmp_query record: %s", exc)
        raise

# ---------------------------------------------------------------------------
# Lambda entry point
# ---------------------------------------------------------------------------

def handle(event: dict, context) -> dict:
    logger.info("Received event: %s", json.dumps(event))

    detail = event.get("detail", {})
    bucket = detail.get("bucket", {}).get("name", MEDIA_BUCKET_NAME)
    key = detail.get("object", {}).get("key", "")

    if not key:
        logger.error("No object key in event detail: %s", detail)
        return {"statusCode": 400, "body": "Missing object key"}

    decoded_key = urllib.parse.unquote_plus(key)
    logger.info("Processing tmp upload: s3://%s/%s", bucket, decoded_key)

    media_type, file_id, _ = _canonical_parts(decoded_key)
    file_type = "video" if media_type == "videos" else "image"

    checksum, user_id = _get_metadata(bucket, decoded_key)
    if not checksum:
        logger.warning("No checksum found for %s — skipping", decoded_key)
        return {
            "statusCode": 200,
            "body": json.dumps({"skipped": True, "reason": "missing_checksum"}),
        }

    logger.info(
        "file_id=%s file_type=%s user_id=%s checksum=%s",
        file_id, file_type, user_id, checksum,
    )

    _emit_metadata_created(
        source_key=decoded_key,
        file_id=file_id,
        checksum=checksum,
        file_type=file_type,
    )

    _write_tmp_record(
    file_id=file_id,
    file_type=file_type,
    checksum=checksum,
    )

    return {
    "statusCode": 200,
    "body": json.dumps({
        "file_id": file_id,
        "file_type": file_type,
        "job_type": "temporary",
        "status": "processing"
    }),
}
