import json
import boto3
import os
from decimal import Decimal
from urllib.parse import urlparse

dynamodb = boto3.resource('dynamodb', region_name=os.environ['AWS_REGION_NAME'])
table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])
s3 = boto3.client('s3', region_name=os.environ['AWS_REGION_NAME'])

def parse_s3_url(s3_url):
    # Convert s3://bucket-name/key to bucket and key
    parsed = urlparse(s3_url)
    bucket = parsed.netloc
    key = parsed.path.lstrip('/')
    return bucket, key

def handler(event, context):
    # Input: {"urls": ["s3://bucket/file.jpg", ...]}
    body = json.loads(event.get('body', '{}'))
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
            # Get the record from DynamoDB first
            response = table.get_item(Key={'file_url': url})
            item = response.get('Item')

            if not item:
                failed.append({'url': url, 'reason': 'Not found in database'})
                continue

            # Delete thumbnail from S3 if exists
            thumbnail_url = item.get('thumbnail_url')
            if thumbnail_url:
                try:
                    bucket, key = parse_s3_url(thumbnail_url)
                    s3.delete_object(Bucket=bucket, Key=key)
                except Exception as e:
                    print(f"Warning: Could not delete thumbnail {thumbnail_url}: {e}")

            # Delete main file from S3
            try:
                bucket, key = parse_s3_url(url)
                s3.delete_object(Bucket=bucket, Key=key)
            except Exception as e:
                print(f"Warning: Could not delete file {url}: {e}")

            # Delete from DynamoDB
            table.delete_item(Key={'file_url': url})
            deleted.append(url)

        except Exception as e:
            failed.append({'url': url, 'reason': str(e)})

    return {
        'statusCode': 200,
        'body': json.dumps({
            'deleted': deleted,
            'failed': failed
        })
    }