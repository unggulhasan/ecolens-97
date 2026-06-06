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
                # Add tags — set/update to specified count (format: "tag:count")
                for tag in tags:
                    count = 1
                    tag_name = tag
                    if ':' in tag:
                        parts = tag.split(':', 1)
                        tag_name = parts[0]
                        try:
                            count = int(parts[1])
                        except ValueError:
                            count = 1
                    elif '=' in tag:
                        parts = tag.split('=', 1)
                        tag_name = parts[0]
                        try:
                            count = int(parts[1])
                        except ValueError:
                            count = 1

                    normalized_tag = tag_name.strip().lower()
                    if normalized_tag:
                        if normalized_tag not in existing_tags:
                            newly_added_tags.append(normalized_tag)
                        existing_tags[normalized_tag] = Decimal(count)
            else:
                # Remove tags — ignore if not present (as per spec)
                for tag in tags:
                    tag_name = tag.split(':', 1)[0].split('=', 1)[0]
                    normalized_tag = tag_name.strip().lower()
                    existing_tags.pop(normalized_tag, None)

            # Update the record using PK
            table.update_item(
                Key={'file_id': file_id},
                UpdateExpression='SET tags = :tags',
                ExpressionAttributeValues={':tags': existing_tags}
            )

            # Write notifications to DynamoDB notifications table and publish SNS alerts
            notifications_table_name = os.environ.get('NOTIFICATIONS_TABLE_NAME')
            subscriptions_table_name = os.environ.get('SUBSCRIPTIONS_TABLE_NAME')
            sns_topic_arn = os.environ.get('SNS_TOPIC_ARN')

            if operation == 1 and newly_added_tags:
                # 1. Retrieve all subscriptions
                subs = []
                if subscriptions_table_name:
                    try:
                        subscriptions_table = dynamodb.Table(subscriptions_table_name)
                        response = subscriptions_table.scan()
                        subs = response.get('Items', [])
                        while 'LastEvaluatedKey' in response:
                            response = subscriptions_table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
                            subs.extend(response.get('Items', []))
                    except Exception as scan_err:
                        logger.error("Failed to scan subscriptions: %s", str(scan_err))

                # 2. For each newly added tag, find matching subscription tags and trigger notifications
                for tag in newly_added_tags:
                    normalized_tag = tag.strip().lower()

                    # Find subscription tags that are substrings of the newly added tag
                    matching_sub_tags = []
                    for sub in subs:
                        sub_tags = sub.get('tags', [])
                        for sub_tag in sub_tags:
                            normalized_sub_tag = sub_tag.strip().lower()
                            if normalized_sub_tag in normalized_tag:
                                matching_sub_tags.append(normalized_sub_tag)

                    # Deduplicate and include the actual tag itself
                    matched_policy_tags = list(set([normalized_tag] + matching_sub_tags))

                    # Send SNS alert with String.Array attribute containing all matching tags
                    if sns_topic_arn:
                        try:
                            sns = boto3.client('sns', region_name=os.environ.get('AWS_REGION_NAME', 'ap-southeast-4'))
                            message_body = (
                                f"Notification: A new wildlife file has been tagged in Aussie Ecolens!\n\n"
                                f"Species Tag: {normalized_tag}\n"
                                f"File URL: {url}\n"
                                f"Timestamp: {item.get('uploaded_at', 'unknown')}\n\n"
                                f"Log in to the system to search and view the full file."
                            )
                            subject = f"Aussie Ecolens: New {normalized_tag} file uploaded"

                            logger.info("Publishing alert to SNS for tag: %s (matched filter tags: %s)", normalized_tag, matched_policy_tags)
                            sns.publish(
                                TopicArn=sns_topic_arn,
                                Message=message_body,
                                Subject=subject,
                                MessageAttributes={
                                    'tag': {
                                        'DataType': 'String.Array',
                                        'StringValue': json.dumps(matched_policy_tags)
                                    }
                                }
                            )
                        except Exception as e:
                            logger.error("Failed to publish SNS notifications for tag %s: %s", normalized_tag, str(e))

                    # 3. Create database notification records for users who subscribed to a matching tag
                    if notifications_table_name:
                        try:
                            notifications_table = dynamodb.Table(notifications_table_name)
                            import uuid
                            import datetime

                            for sub in subs:
                                user_id = sub.get('user_id')
                                sub_tags = sub.get('tags', [])

                                if not user_id or not sub_tags:
                                    continue

                                # Find if any subscription tag is a substring of the newly added tag
                                user_matching_tags = [
                                    st.strip().lower() for st in sub_tags
                                    if st.strip().lower() in normalized_tag
                                ]

                                if user_matching_tags:
                                    # Write a notification record for each matching tag for this user
                                    for matching_tag in user_matching_tags:
                                        notif_id = f"{datetime.datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}#{uuid.uuid4().hex[:8]}"
                                        timestamp = datetime.datetime.utcnow().isoformat() + 'Z'

                                        title = f"Wildlife Detected: {matching_tag.capitalize()}"
                                        message = f"A new file containing \"{matching_tag}\" has been tagged in Aussie Ecolens."

                                        notifications_table.put_item(
                                            Item={
                                                'user_id': user_id,
                                                'notification_id': notif_id,
                                                'title': title,
                                                'message': message,
                                                'read': False,
                                                'timestamp': timestamp,
                                                'file_url': url,
                                                'tag': matching_tag
                                            }
                                        )
                                        logger.info("Saved notification for user %s, tag: %s (matching tag: %s)", user_id, normalized_tag, matching_tag)
                        except Exception as db_err:
                            logger.error("Failed to save database notifications for tag %s: %s", normalized_tag, str(db_err))

            updated.append({
                'file_url': url,
                'final_tags': {k: int(v) for k, v in existing_tags.items()},
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


