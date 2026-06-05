import json
import os
from decimal import Decimal
from urllib.parse import urlparse

import boto3
from botocore.config import Config

REGION_NAME = os.environ['AWS_REGION_NAME']

dynamodb = boto3.resource('dynamodb', region_name=REGION_NAME)
table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])
s3 = boto3.client(
    's3',
    region_name=REGION_NAME,
    endpoint_url=f"https://s3.{REGION_NAME}.amazonaws.com",
    config=Config(signature_version='s3v4'),
)

PAGE_SIZE = 10
PRESIGN_EXPIRY = 3600  # 1 hour


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj)
        return super().default(obj)


def _parse_s3_url(s3_url: str) -> tuple[str, str]:
    """Parse s3://bucket/key into (bucket, key)."""
    parsed = urlparse(s3_url)
    if parsed.scheme != 's3':
        raise ValueError(f"Expected s3:// URL, got: {s3_url}")
    bucket = parsed.netloc
    key = parsed.path.lstrip('/')
    return bucket, key


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


def _build_item(item: dict) -> dict:
    """Transform a DynamoDB item into the API response shape."""
    file_url = item.get('file_url')
    thumbnail_url = item.get('thumbnail_url')

    result = {
        'file_id': item.get('file_id'),
        'file_type': item.get('file_type'),
        'file_url': file_url,
        'thumbnail_url': thumbnail_url,
        'uploaded_at': item.get('uploaded_at'),
        'user_id': item.get('user_id'),
    }

    if 'tags' in item:
        result['tags'] = item['tags']

    if file_url:
        file_http = _generate_presigned_get(file_url)
        if file_http:
            result['file_url_http'] = file_http

    if thumbnail_url:
        thumb_http = _generate_presigned_get(thumbnail_url)
        if thumb_http:
            result['thumbnail_url_http'] = thumb_http

    return result


def _get_user_email(event):
    claims = (
        event.get('requestContext', {})
        .get('authorizer', {})
        .get('jwt', {})
        .get('claims', {})
    )
    return claims.get('email', '')


def handle(event, context):
    # Parse page from query string (API Gateway v2 format)
    qs = event.get('queryStringParameters') or {}
    try:
        page = int(qs.get('page', 1))
        if page < 1:
            page = 1
    except (ValueError, TypeError):
        page = 1

    mine_only = str(qs.get('mine', '')).lower() in ('1', 'true', 'yes')
    user_email = _get_user_email(event) if mine_only else ''

    if mine_only and not user_email:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Unauthorized'}),
        }

    # Scan and sort by uploaded_at descending
    response = table.scan()
    items = response.get('Items', [])

    if mine_only:
        items = [item for item in items if item.get('user_id') == user_email]

    # Sort: most recent first. Items without uploaded_at go to the end.
    items.sort(
        key=lambda x: x.get('uploaded_at', ''),
        reverse=True,
    )

    # Paginate
    start = (page - 1) * PAGE_SIZE
    end = page * PAGE_SIZE
    page_items = items[start:end]

    # Build response
    results = [_build_item(item) for item in page_items]

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'page': page,
            'page_size': PAGE_SIZE,
            'total': len(items),
            'results': results,
        }, cls=DecimalEncoder),
    }
