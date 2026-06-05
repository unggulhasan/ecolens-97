"""Resolver Lambda — triggered by MetadataCreated custom event.

Reads the DynamoDB record (confirmatory), generates a presigned S3 GET URL,
then emits `ecolens.gcp.inference` to the default bus. The EventBridge API
Destination picks up that event and delivers it to GCP Cloud Function with
retries.
"""

import json
import logging
import os
import urllib.parse

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

MEDIA_BUCKET_NAME = os.environ["MEDIA_BUCKET_NAME"]
DYNAMODB_TABLE_NAME = os.environ["DYNAMODB_TABLE_NAME"]
EVENT_BUS_NAME = os.environ.get("EVENT_BUS_NAME", "default")

REGION_NAME = os.environ.get("REGION_NAME", "ap-southeast-4")
s3 = boto3.client(
    "s3",
    region_name=REGION_NAME,
    endpoint_url=f"https://s3.{REGION_NAME}.amazonaws.com",
)
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(DYNAMODB_TABLE_NAME)
events = boto3.client("events")

PRESIGNED_EXPIRY = int(os.environ.get("PRESIGNED_EXPIRY", "1800"))


def _read_dynamodb_record(file_id: str) -> dict | None:
    """Confirm the DynamoDB record exists (it should, but be defensive)."""
    try:
        resp = table.get_item(Key={"file_id": file_id})
        item = resp.get("Item")
        if item:
            logger.info("DynamoDB record found for file_id=%s", file_id)
        else:
            logger.warning("No DynamoDB record for file_id=%s", file_id)
        return item
    except Exception as exc:
        logger.error("DynamoDB GetItem failed for file_id=%s: %s", file_id, exc)
        raise


def _generate_presigned_url(bucket: str, key: str) -> str:
    """Generate a presigned GET URL for the source S3 object."""
    try:
        url = s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=PRESIGNED_EXPIRY,
        )
        logger.info("Presigned URL generated for s3://%s/%s (expires %ds)", bucket, key, PRESIGNED_EXPIRY)
        return url
    except Exception as exc:
        logger.error("Failed to generate presigned URL for s3://%s/%s: %s", bucket, key, exc)
        raise


def _emit_inference_event(file_id: str, presigned_url: str) -> None:
    """Emit `ecolens.gcp.inference` custom event for EventBridge → GCP delivery."""
    events.put_events(
        Entries=[
            {
                "Source": "ecolens.gcp.inference",
                "DetailType": "GcpInferenceRequest",
                "Detail": json.dumps({
                    "file_id": file_id,
                    "presigned_url": presigned_url,
                }),
                "EventBusName": EVENT_BUS_NAME,
            }
        ]
    )
    logger.info("Emitted GcpInferenceRequest for file_id=%s", file_id)


def handle(event, context):
    logger.info("Received event: %s", json.dumps(event))

    detail = event.get("detail", {})

    file_id = detail.get("file_id")
    source_key = detail.get("source_key")

    if not file_id or not source_key:
        logger.error("Missing file_id or source_key in event detail: %s", detail)
        return {"statusCode": 400, "body": "Missing file_id or source_key"}

    logger.info("Resolving file_id=%s source_key=%s", file_id, source_key)

    # 1. Confirm DynamoDB record exists
    record = _read_dynamodb_record(file_id)
    if not record:
        return {"statusCode": 404, "body": f"No record found for file_id={file_id}"}

    # 2. Generate presigned S3 URL
    presigned_url = _generate_presigned_url(MEDIA_BUCKET_NAME, source_key)

    # 3. Emit inference event for EventBridge → GCP
    _emit_inference_event(file_id, presigned_url)

    return {
        "statusCode": 200,
        "body": json.dumps({
            "file_id": file_id,
            "message": "Inference event emitted",
        }),
    }
