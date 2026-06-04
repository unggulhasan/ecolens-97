import json
import logging
import os
import urllib.parse

import boto3
import botocore.exceptions
from botocore.config import Config
import cv2
import numpy as np

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment -----------------------------------------------------------------
# Required bucket where media files live. Fail fast if not provided.
MEDIA_BUCKET_NAME: str = os.environ["MEDIA_BUCKET_NAME"]
# Region is optional – fall back to the current AWS region if omitted.
REGION_NAME: str | None = os.environ.get("REGION_NAME")

# Thumbnail tuning ----------------------------------------------------------------
# Resize so the longest edge is MAX_DIMENSION pixels.
MAX_DIMENSION: int = 300
# JPEG quality (0–100, lower values produce smaller files).
JPEG_QUALITY: int = 85


_config = Config(retries={"max_attempts": 5, "mode": "adaptive"})
s3 = boto3.client("s3", region_name=REGION_NAME, config=_config)


def _thumbnail_key(original_key: str) -> str:
    """Map  images/{file_id}/<name>  →  thumbnails/{file_id}/<name>."""
    parts = original_key.split("/")
    # expected: ["images", "<file_id>", "<filename>"]
    file_id = parts[1] if len(parts) >= 3 else "unknown"
    filename = parts[-1]
    base, _ = os.path.splitext(filename)
    return f"thumbnails/{file_id}/{base}.jpg"


def _resize(img: np.ndarray) -> np.ndarray:
    """Resize so the longest dimension is MAX_DIMENSION, preserving aspect ratio."""
    h, w = img.shape[:2]
    longest = max(h, w)
    if longest <= MAX_DIMENSION:
        return img
    scale = MAX_DIMENSION / longest
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)


def _get_metadata(bucket: str, key: str) -> tuple[str, str]:
    """Read user_id and checksum from S3 object metadata/checksum."""
    try:
        head = s3.head_object(Bucket=bucket, Key=key, ChecksumMode="ENABLED")
        user_id = head.get("Metadata", {}).get("user-email", "")
        checksum = head.get("ChecksumSHA256", "")
        return user_id, checksum
    except botocore.exceptions.ClientError as e:
        logger.warning("Could not read metadata for %s: %s", key, e)
        return "", ""


def _thumbnail_exists(bucket: str, thumbnail_key: str) -> bool:
    """Return True if a thumbnail has already been generated for this key."""
    try:
        s3.head_object(Bucket=bucket, Key=thumbnail_key)
        return True
    except botocore.exceptions.ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return False
        raise


def _extract_file_id(key: str) -> str:
    """Extract file-id from key path images/{file_id}/{filename}."""
    parts = key.split("/")
    return parts[1] if len(parts) >= 3 else "unknown"


def _process(bucket: str, key: str) -> dict:
    decoded_key = urllib.parse.unquote_plus(key)
    logger.info("Processing s3://%s/%s", bucket, decoded_key)

    user_id, checksum = _get_metadata(bucket, decoded_key)
    logger.info("User ID from S3 metadata: %s", user_id)
    logger.info("Checksum from S3 metadata: %s", checksum)

    if not checksum:
        logger.warning(
            "Skipping thumbnail generation for %s: no checksum in object metadata. "
            "Object was likely not uploaded through the presign endpoint.",
            decoded_key,
        )
        return {
            "source_key": decoded_key,
            "skipped": True,
            "reason": "missing_checksum",
        }

    file_id = _extract_file_id(decoded_key)
    out_key = _thumbnail_key(decoded_key)
    logger.info("File ID: %s | Thumbnail key: %s", file_id, out_key)

    if _thumbnail_exists(MEDIA_BUCKET_NAME, out_key):
        logger.info("Thumbnail already exists at %s, skipping.", out_key)
        return {
            "source_key": decoded_key,
            "thumbnail_key": out_key,
            "skipped": True,
            "reason": "thumbnail_already_exists",
        }

    response = s3.get_object(Bucket=bucket, Key=decoded_key)
    raw = response["Body"].read()

    # Decode image with OpenCV
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"cv2.imdecode returned None for key={decoded_key!r}")

    thumbnail = _resize(img)

    # Encode as JPEG with quality compression
    encode_params = [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
    ok, buf = cv2.imencode(".jpg", thumbnail, encode_params)
    if not ok:
        raise RuntimeError("cv2.imencode failed")

    out_size = len(buf)
    logger.info(
        "Uploading thumbnail (%dx%d, %d bytes) to s3://%s/%s",
        thumbnail.shape[1],
        thumbnail.shape[0],
        out_size,
        MEDIA_BUCKET_NAME,
        out_key,
    )

    # Forward identifying metadata on the thumbnail object so the downstream
    # metadata Lambda can read them without re-fetching the original image.
    s3.put_object(
        Bucket=MEDIA_BUCKET_NAME,
        Key=out_key,
        Body=buf.tobytes(),
        ContentType="image/jpeg",
        Metadata={
            "user-email": user_id,
            "checksum": checksum,
            "source-key": decoded_key,
            "file-id": file_id,
        },
    )

    return {
        "source_key": decoded_key,
        "thumbnail_key": out_key,
        "original_size_bytes": len(raw),
        "thumbnail_size_bytes": out_size,
        "thumbnail_width": thumbnail.shape[1],
        "thumbnail_height": thumbnail.shape[0],
        "user_id": user_id,
        "skipped": False,
    }


def handle(event: dict, context) -> dict:
    logger.info("Received event: %s", json.dumps(event))

    detail = event.get("detail", {})
    bucket = detail.get("bucket", {}).get("name", MEDIA_BUCKET_NAME)
    key = detail.get("object", {}).get("key", "")

    if not key:
        logger.error("No object key found in event detail: %s", detail)
        return {"statusCode": 400, "body": "Missing object key in event"}

    result = _process(bucket, key)
    logger.info("Done: %s", result)
    return {"statusCode": 200, "body": json.dumps(result)}
