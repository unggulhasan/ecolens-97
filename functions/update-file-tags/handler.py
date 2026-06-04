import json
import boto3
import os
import logging
from decimal import Decimal
from urllib.parse import urlparse

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb', region_name=os.environ['AWS_REGION_NAME'])
table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])


def extract_file_id(url):
    # URL format: s3://bucket/images/{uuid}/filename.jpg
    parsed = urlparse(url)
    parts = parsed.path.lstrip('/').split('/')
    # parts = ['images', '{uuid}', 'filename.jpg'] - index 1 is the file_id (UUID)
    if len(parts) < 2:
        raise ValueError(f"Cannot extract file_id from URL: {url}")
    return parts[1]


def handle(event, context):
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid JSON body'})
        }

    urls = body.get('file_urls', [])
    tags = body.get('tags', [])
    operation = body.get('operation')

    if not urls or not tags or operation is None:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'file_urls, tags and operation are required'})
        }

    if operation not in (0, 1):
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'operation must be 1 (add) or 0 (remove)'})
        }

    updated = []
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

            existing_tags = item.get('tags', {})
            newly_added_tags = []

            if operation == 1:
                # Add tags — set to 1 if not present, don't overwrite existing counts
                for tag in tags:
                    normalized_tag = tag.strip().lower()
                    if normalized_tag not in existing_tags:
                        existing_tags[normalized_tag] = Decimal(1)
                        newly_added_tags.append(normalized_tag)
            else:
                # Remove tags — ignore if not present (as per spec)
                for tag in tags:
                    normalized_tag = tag.strip().lower()
                    existing_tags.pop(normalized_tag, None)

            # Update the record using PK
            table.update_item(
                Key={'file_id': file_id},
                UpdateExpression='SET tags = :tags',
                ExpressionAttributeValues={':tags': existing_tags}
            )

            # Publish SNS notifications if tags were newly added and SNS_TOPIC_ARN is configured
            sns_topic_arn = os.environ.get('SNS_TOPIC_ARN')
            if operation == 1 and newly_added_tags and sns_topic_arn:
                try:
                    sns = boto3.client('sns', region_name=os.environ.get('AWS_REGION_NAME', 'ap-southeast-4'))
                    for tag in newly_added_tags:
                        message_body = (
                            f"Notification: A new wildlife file has been tagged in Aussie Ecolens!\n\n"
                            f"Species Tag: {tag}\n"
                            f"File URL: {url}\n"
                            f"Timestamp: {item.get('uploaded_at', 'unknown')}\n\n"
                            f"Log in to the system to search and view the full file."
                        )
                        subject = f"Aussie Ecolens: New {tag} file uploaded"

                        logger.info("Publishing alert to SNS for tag: %s", tag)
                        sns.publish(
                            TopicArn=sns_topic_arn,
                            Message=message_body,
                            Subject=subject,
                            MessageAttributes={
                                'tag': {
                                    'DataType': 'String',
                                    'StringValue': tag
                                }
                            }
                        )
                except Exception as e:
                    logger.error("Failed to publish SNS notifications: %s", str(e))

            updated.append({
                'file_url': url,
                'final_tags': list(existing_tags.keys())
            })

        except ValueError as e:
            failed.append({'url': url, 'reason': str(e)})
        except Exception as e:
            failed.append({'url': url, 'reason': str(e)})

    return {
        'statusCode': 200,
        'body': json.dumps({
            'updated': updated,
            'failed': failed
        })
    }


