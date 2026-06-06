import json
import boto3
import os
from decimal import Decimal
from urllib.parse import urlparse
from boto3.dynamodb.conditions import Attr

from botocore.config import Config

dynamodb = boto3.resource('dynamodb', region_name=os.environ['AWS_REGION_NAME'])
table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])
s3 = boto3.client(
    's3',
    region_name=os.environ['AWS_REGION_NAME'],
    endpoint_url=f"https://s3.{os.environ['AWS_REGION_NAME']}.amazonaws.com",
    config=Config(signature_version='s3v4')
)

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

def _generate_presigned_get(file_url: str) -> str | None:
    """Generate a 1-hour presigned GET URL for the S3 object."""
    try:
        bucket, key = _parse_s3_url(file_url)
        return s3.generate_presigned_url(
            ClientMethod='get_object',
            Params={'Bucket': bucket, 'Key': key},
            ExpiresIn=3600,
        )
    except Exception as e:
        print(f"Warning: Failed to generate presigned URL for {file_url}: {e}")
        return None

def handle(event, context):
    # Input: {"thumbnail_url": "s3://..."}
    body = json.loads(event.get('body', '{}'))
    thumbnail_url = body.get('thumbnail_url')

    if not thumbnail_url:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'No thumbnail_url provided'})
        }

    # Scan for matching thumbnail URL
    response = table.scan(
        FilterExpression=Attr('thumbnail_url').eq(thumbnail_url)
    )
    items = response['Items']

    if not items:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': 'Thumbnail not found'})
        }

    item = items[0]
    file_url = item['file_url']
    file_url_http = _generate_presigned_get(file_url)

    thumbnail_url = item.get('thumbnail_url')
    thumbnail_url_http = _generate_presigned_get(thumbnail_url) if thumbnail_url else None

    return {
        'statusCode': 200,
        'body': json.dumps({
            'file_url': file_url,
            'file_url_http': file_url_http or file_url,
            'thumbnail_url': thumbnail_url,
            'thumbnail_url_http': thumbnail_url_http or file_url_http or file_url,
            'user_id': item.get('user_id'),
            'tags': item.get('tags', {})
        }, cls=DecimalEncoder)
    }