import io
import json
import logging
import os
import urllib.parse

import boto3
import cv2
import numpy as np

logger = logging.getLogger()
logger.setLevel(logging.INFO)

MEDIA_BUCKET_NAME = os.environ["MEDIA_BUCKET_NAME"]
REGION_NAME = os.environ.get("REGION_NAME", "us-east-1")
MAX_DIMENSION = 300
JPEG_QUALITY = 85  # 0-100; lower = smaller file

s3 = boto3.client("s3", region_name=REGION_NAME)


def _thumbnail_key(original_key: str) -> str:
    """Map  images/<name>  →  thumbnails/<name>  (strip any leading prefix)."""
    filename = original_key.split("/")[-1]
    # Store as JPEG regardless of original format for consistent compression
    base, _ = os.path.splitext(filename)
    thumbnail_key = f"thumbnails/{base}.jpg"
    logger.info(f"thumbnail key: {thumbnail_key}")
    return thumbnail_key


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


def _process(bucket: str, key: str) -> dict:
    decoded_key = urllib.parse.unquote_plus(key)
    logger.info("Downloading s3://%s/%s", bucket, decoded_key)

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

    out_key = _thumbnail_key(decoded_key)
    out_size = len(buf)
    logger.info(
        "Uploading thumbnail (%dx%d, %d bytes) to s3://%s/%s",
        thumbnail.shape[1], thumbnail.shape[0], out_size,
        MEDIA_BUCKET_NAME, out_key,
    )

    s3.put_object(
        Bucket=MEDIA_BUCKET_NAME,
        Key=out_key,
        Body=buf.tobytes(),
        ContentType="image/jpeg",
    )

    return {
        "source_key": decoded_key,
        "thumbnail_key": out_key,
        "original_size_bytes": len(raw),
        "thumbnail_size_bytes": out_size,
        "thumbnail_width": thumbnail.shape[1],
        "thumbnail_height": thumbnail.shape[0],
    }


def handler(event, context):
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

