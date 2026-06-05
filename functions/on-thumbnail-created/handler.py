"""metadata Lambda

Triggered by EventBridge "Object Created" on the thumbnails/ and videos/ S3 prefixes.
Reads identifying metadata forwarded by the thumbnail Lambda (for images) or 
directly from the video object (for videos), then writes the canonical record to DynamoDB.

This keeps DynamoDB persistence separate from image processing so each
concern can be retried, scaled, and monitored independently.
"""

import datetime
import json
import logging
import os
import urllib.parse

import boto3
from botocore.config import Config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

MEDIA_BUCKET_NAME = os.environ["MEDIA_BUCKET_NAME"]
REGION_NAME = os.environ.get("REGION_NAME", "ap-southeast-4")
DYNAMODB_TABLE_NAME = os.environ["DYNAMODB_TABLE_NAME"]

s3 = boto3.client(
    "s3",
    region_name=REGION_NAME,
    endpoint_url=f"https://s3.{REGION_NAME}.amazonaws.com",
    config=Config(signature_version="s3v4")
)
dynamodb = boto3.resource("dynamodb", region_name=REGION_NAME)
table = dynamodb.Table(DYNAMODB_TABLE_NAME)


def _parse_s3_url(s3_url: str) -> tuple[str, str]:
    """Parse s3://bucket/key into (bucket, key)."""
    parsed = urlparse(s3_url)
    if parsed.scheme != "s3":
        raise ValueError(f"Expected s3:// URL, got: {s3_url}")
    bucket = parsed.netloc
    key = parsed.path.lstrip("/")
    return bucket, key


def _read_s3_metadata(bucket: str, key: str) -> dict:
    """Read the S3 object metadata forwarded by the thumbnail Lambda or from the video."""
    head = s3.head_object(Bucket=bucket, Key=key, ChecksumMode="ENABLED")
    meta = head.get("Metadata", {})
    
    if key.startswith("videos/"):
        return {
            "user_id": meta.get("user-email", ""),
            "checksum": head.get("ChecksumSHA256", ""),
            "source_key": key,
            "file_id": meta.get("file-id", ""),
            "is_video": True
        }
    else:
        return {
            "user_id": meta.get("user-email", ""),
            "checksum": meta.get("checksum", ""),
            "source_key": meta.get("source-key", ""),
            "file_id": meta.get("file-id", ""),
            "is_video": False
        }


def _write_record(bucket: str, thumb_key: str, meta: dict) -> None:
    """Write the media file record to DynamoDB."""
    file_url = f"s3://{bucket}/{meta['source_key']}" if meta["source_key"] else ""
    thumbnail_url = f"s3://{bucket}/{thumb_key}" if not meta.get("is_video") else ""

    item = {
        "file_id": meta["file_id"] or "unknown",
        "checksum": meta["checksum"],
        "file_url": file_url,
        "file_type": "video" if meta.get("is_video") else "image",
        "uploaded_at": datetime.datetime.utcnow().isoformat() + "Z",
        "user_id": meta["user_id"],
    }

    if thumbnail_url:
        item["thumbnail_url"] = thumbnail_url

    table.put_item(
        Item=item,
        ConditionExpression="attribute_not_exists(file_id)",
    )
    logger.info(
        "DynamoDB record written: file_id=%s user=%s type=%s file_url=%s",
        item["file_id"],
        item["user_id"],
        item["file_type"],
        file_url,
    )


def handle(event, context):
    logger.info("Received event: %s", json.dumps(event))

    detail = event.get("detail", {})
    bucket = detail.get("bucket", {}).get("name", MEDIA_BUCKET_NAME)
    key = detail.get("object", {}).get("key", "")

    if not key:
        logger.error("No object key in event detail: %s", detail)
        return {"statusCode": 400, "body": "Missing object key in event"}

    decoded_key = urllib.parse.unquote_plus(key)
    logger.info("Processing s3://%s/%s", bucket, decoded_key)

    meta = _read_s3_metadata(bucket, decoded_key)
    logger.info("Metadata from S3 object: %s", meta)

    _write_record(bucket, decoded_key, meta)

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "key": decoded_key,
                "file_id": meta["file_id"],
                "user_id": meta["user_id"],
            }
        ),
    }
