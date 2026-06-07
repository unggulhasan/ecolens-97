import json
import boto3
import os
from decimal import Decimal
from urllib.parse import urlparse
from botocore.config import Config

dynamodb = boto3.resource('dynamodb', region_name=os.environ['AWS_REGION_NAME'])
table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])
tmp_table = dynamodb.Table(os.environ['TMP_TABLE_NAME'])  # tmp_query

s3 = boto3.client(
    's3',
    region_name=os.environ['AWS_REGION_NAME'],
    endpoint_url=f"https://s3.{os.environ['AWS_REGION_NAME']}.amazonaws.com",
    config=Config(signature_version='s3v4')
)


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
    if not file_url:
        return None
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


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj)
        return super().default(obj)


def handle(event, context):
    """
    Query 4: Find files matching tags of a temporarily uploaded file.

    Input:  {"file_id": "uuid-of-tmp-uploaded-file"}
    Output: {"results": [...thumbnail_urls for images, file_urls for videos...]}

    Flow:
      1. Look up file_id in tmp_query table → get detected tags
      2. Scan main table for files matching ALL detected tags (AND logic)
      3. Return thumbnail URLs for images, full URLs for videos
      4. Tmp file is NOT stored in main table
    """
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid JSON body'})
        }

    file_id = body.get('file_id')

    if not file_id:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'file_id is required'})
        }

    # Step 1 — look up detected tags from tmp_query
    tmp_response = tmp_table.get_item(Key={'file_id': file_id})
    tmp_item = tmp_response.get('Item')

    if not tmp_item:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': 'Temporary file not found. It may still be processing.'})
        }
    # Check if ML inference is complete
    status = tmp_item.get('status', 'processing')
    if status not in ('complete', 'completed'):
        return {
            'statusCode': 202,
            'body': json.dumps({
                'status': 'processing',
                'file_id': file_id,
                'message': 'ML inference is still running. Please try again shortly.'
            })
        }

    detected_tags = tmp_item.get('tags')
    if not isinstance(detected_tags, dict):
        detected_tags = {}

    # Clear from temporary S3 storage
    s3_key = tmp_item.get('s3_key')
    bucket_name = os.environ.get('MEDIA_BUCKET_NAME')
    if s3_key and bucket_name:
        try:
            s3.delete_object(Bucket=bucket_name, Key=s3_key)
            print(f"Successfully deleted temporary query S3 object: s3://{bucket_name}/{s3_key}")
        except Exception as e:
            print(f"Warning: Failed to delete temporary S3 object {s3_key}: {e}")

    # Clear from temporary database (tmp_query) as inference is complete and we have the tags
    try:
        tmp_table.delete_item(Key={'file_id': file_id})
    except Exception as e:
        print(f"Warning: Failed to delete temporary query item {file_id}: {e}")

    if not detected_tags:
        return {
            'statusCode': 200,
            'body': json.dumps({'results': [], 'detected_tags': []})
        }

    tag_names = list(detected_tags.keys())

    # Step 2 — scan main table for files matching ALL detected tags (AND logic)
    matching = []
    scan_kwargs = {}

    while True:
        response = table.scan(**scan_kwargs)
        items = response.get('Items', [])

        for item in items:
            item_tags = item.get('tags')
            if not isinstance(item_tags, dict):
                item_tags = {}
            match = all(
                item_tags.get(tag, 0) >= 1
                for tag in tag_names
            )
            if match:
                file_url = item.get('file_url')
                thumbnail_url = item.get('thumbnail_url')
                matching.append({
                    'file_url': file_url,
                    'file_url_http': _generate_presigned_get(file_url) or file_url,
                    'thumbnail_url': thumbnail_url,
                    'thumbnail_url_http': _generate_presigned_get(thumbnail_url) if thumbnail_url else None,
                    'user_id': item.get('user_id'),
                    'tags': item_tags
                })

        last_key = response.get('LastEvaluatedKey')
        if not last_key:
            break
        scan_kwargs['ExclusiveStartKey'] = last_key

    return {
        'statusCode': 200,
        'body': json.dumps({
            'results': matching,
            'detected_tags': tag_names
        }, cls=DecimalEncoder)
    }