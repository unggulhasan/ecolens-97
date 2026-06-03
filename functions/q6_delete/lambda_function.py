import json
import boto3
import os
from urllib.parse import urlparse

dynamodb = boto3.resource('dynamodb', region_name=os.environ['AWS_REGION_NAME'])
table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])
s3 = boto3.client('s3', region_name=os.environ['AWS_REGION_NAME'])


def extract_file_id(url):
    # URL format: s3://bucket/images/{uuid}/filename.jpg
    parsed = urlparse(url)
    parts = parsed.path.lstrip('/').split('/')
    if len(parts) < 2:
        raise ValueError(f"Cannot extract file_id from URL: {url}")
    return parts[1]


def parse_s3_url(s3_url):
    # Handles s3://bucket/key format — confirmed team convention
    # Defensive fallback for https://bucket.s3.region.amazonaws.com/key
    parsed = urlparse(s3_url)
    if parsed.scheme == 's3':
        bucket = parsed.netloc
        key = parsed.path.lstrip('/')
    elif parsed.scheme in ('https', 'http'):
        host = parsed.netloc
        if '.s3.' not in host:
            raise ValueError(f"Cannot parse HTTPS S3 URL — unexpected host: {host}")
        bucket = host.split('.s3.')[0]
        key = parsed.path.lstrip('/')
    else:
        raise ValueError(f"Unrecognised S3 URL format: {s3_url}")
    if not bucket or not key:
        raise ValueError(f"Could not extract bucket/key from URL: {s3_url}")
    return bucket, key


def handler(event, context):
    """
    Query 6: Delete files and thumbnails from S3 and DynamoDB.

    Input:  {"urls": ["s3://bucket/images/{uuid}/filename.jpg", ...]}
    Output: {"deleted": [...], "failed": [...]}
    """
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid JSON body'})
        }

    urls = body.get('urls', [])

    if not urls:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'No URLs provided'})
        }

    deleted = []
    failed = []

    for url in urls:
        try:
            # Extract file_id (UUID) from URL — used as PK
            file_id = extract_file_id(url)

            # Look up record by PK
            response = table.get_item(Key={'file_id': file_id})
            item = response.get('Item')

            if not item:
                failed.append({'url': url, 'reason': 'Not found in database'})
                continue

            # Delete thumbnail from S3 if exists (images only)
            thumbnail_url = item.get('thumbnail_url')
            if thumbnail_url:
                try:
                    t_bucket, t_key = parse_s3_url(thumbnail_url)
                    s3.delete_object(Bucket=t_bucket, Key=t_key)
                except Exception as e:
                    print(f"Warning: Could not delete thumbnail {thumbnail_url}: {e}")

            # Delete main file from S3
            try:
                f_bucket, f_key = parse_s3_url(url)
                s3.delete_object(Bucket=f_bucket, Key=f_key)
            except Exception as e:
                print(f"Warning: Could not delete file from S3 {url}: {e}")

            # Delete from DynamoDB — always runs even if S3 delete failed
            table.delete_item(Key={'file_id': file_id})
            deleted.append(url)

        except ValueError as e:
            failed.append({'url': url, 'reason': str(e)})
        except Exception as e:
            failed.append({'url': url, 'reason': str(e)})

    return {
        'statusCode': 200,
        'body': json.dumps({
            'deleted': deleted,
            'failed': failed
        })
    }