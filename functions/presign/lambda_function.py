import json
import os
import boto3

MEDIA_BUCKET_NAME = os.environ["MEDIA_BUCKET_NAME"]
REGION_NAME = os.environ.get("REGION_NAME", "ap-southeast-4")
URL_EXPIRATION = 300


def handler(event, context):
    body = json.loads(event.get("body", "{}"))
    filename = body.get("filename")
    file_type = body.get("file_type")
    checksum = body.get("checksum")

    if not filename:
        return _error(400, "Missing required field: filename")
    if not file_type:
        return _error(400, "Missing required field: file_type")
    if not checksum:
        return _error(400, "Missing required field: checksum")

    directory = _dir_for(file_type)
    if not directory:
        return _error(400, f"Unsupported file_type: {file_type}")

    key = f"{directory}/{filename}"

    s3 = boto3.client(
        "s3",
        region_name=REGION_NAME,
        endpoint_url=f"https://s3.{REGION_NAME}.amazonaws.com",
    )

    params = {
        "Bucket": MEDIA_BUCKET_NAME,
        "Key": key,
        "ContentType": file_type,
        # "ChecksumAlgorithm": "SHA256",
        "ChecksumSHA256": checksum,
    }

    try:
        url = s3.generate_presigned_url(
            ClientMethod="put_object",
            Params=params,
            ExpiresIn=URL_EXPIRATION,
        )
    except Exception as e:
        return _error(500, str(e))

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "url": url,
            "key": key,
            "expires_in": URL_EXPIRATION,
        }),
    }


def _dir_for(file_type):
    if file_type.startswith("video/"):
        return "videos"
    if file_type.startswith("image/"):
        return "images"
    return None


def _error(code, message):
    return {
        "statusCode": code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"error": message}),
    }
