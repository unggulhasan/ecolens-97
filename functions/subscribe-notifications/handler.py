import json
import boto3
import os
import logging
import datetime
from urllib.parse import urlparse
from boto3.dynamodb.conditions import Key
from botocore.config import Config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sns = boto3.client('sns', region_name=os.environ.get('AWS_REGION_NAME', 'ap-southeast-4'))
SNS_TOPIC_ARN = os.environ['SNS_TOPIC_ARN']

s3_client = boto3.client(
    's3',
    region_name=os.environ.get('AWS_REGION_NAME', 'ap-southeast-4'),
    endpoint_url=f"https://s3.{os.environ.get('AWS_REGION_NAME', 'ap-southeast-4')}.amazonaws.com",
    config=Config(signature_version='s3v4')
)

dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION_NAME', 'ap-southeast-4'))
SUBSCRIPTIONS_TABLE_NAME = os.environ['SUBSCRIPTIONS_TABLE_NAME']
table = dynamodb.Table(SUBSCRIPTIONS_TABLE_NAME)

def generate_presigned_url(s3_url):
    try:
        parsed = urlparse(s3_url)
        bucket = parsed.netloc
        key = parsed.path.lstrip('/')
        
        return s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': key},
            ExpiresIn=3600 # 1 hour
        )
    except Exception as e:
        logger.error("Failed to generate presigned URL for %s: %s", s3_url, str(e))
        return None

def get_user_id(event):
    claims = event.get('requestContext', {}).get('authorizer', {}).get('jwt', {}).get('claims', {})
    # Use sub (Cognito User UUID) or primary email
    return claims.get('sub') or claims.get('email')

def fetch_sns_subscriptions():
    sns_subs = []
    next_token = ''
    while True:
        if next_token:
            res = sns.list_subscriptions_by_topic(TopicArn=SNS_TOPIC_ARN, NextToken=next_token)
        else:
            res = sns.list_subscriptions_by_topic(TopicArn=SNS_TOPIC_ARN)
        sns_subs.extend(res.get('Subscriptions', []))
        next_token = res.get('NextToken')
        if not next_token:
            break
    return sns_subs

def sync_user_subscriptions(user_id):
    # Query DynamoDB for user's subscriptions
    response = table.query(
        KeyConditionExpression=Key('user_id').eq(user_id)
    )
    db_subs = response.get('Items', [])
    
    # Fetch all active/pending subscriptions from SNS to sync state
    sns_subs = fetch_sns_subscriptions()
    sns_map = {sub.get('Endpoint'): sub for sub in sns_subs}
    
    synced_list = []
    
    for db_sub in db_subs:
        email = db_sub.get('notification_email')
        sns_sub = sns_map.get(email)
        
        if not sns_sub:
            # Sub was deleted/expired in SNS. Delete from DynamoDB as well.
            logger.info("Subscription for %s not found in SNS. Deleting from DB.", email)
            table.delete_item(Key={'user_id': user_id, 'notification_email': email})
            continue
            
        sub_arn = sns_sub.get('SubscriptionArn', '')
        
        if sub_arn == 'PendingConfirmation':
            status = 'pending'
            tags = db_sub.get('tags', [])
            # Update DB to ensure ARN is set correctly to PendingConfirmation
            if db_sub.get('subscription_arn') != 'PendingConfirmation':
                table.put_item(Item={
                    'user_id': user_id,
                    'notification_email': email,
                    'tags': tags,
                    'subscription_arn': 'PendingConfirmation',
                    'updated_at': datetime.datetime.utcnow().isoformat() + 'Z'
                })
        else:
            status = 'verified'
            # Fetch attributes to get latest tags from SNS
            try:
                attrs_response = sns.get_subscription_attributes(SubscriptionArn=sub_arn)
                attributes = attrs_response.get('Attributes', {})
                filter_policy_str = attributes.get('FilterPolicy', '{}')
                filter_policy = json.loads(filter_policy_str)
                tags = filter_policy.get('tag', [])
            except Exception as attr_err:
                logger.error("Failed to get attributes for sub %s: %s", sub_arn, str(attr_err))
                tags = db_sub.get('tags', [])
                
            # If subscription was pending in DB but is now active (has an ARN), update DB
            if db_sub.get('subscription_arn') != sub_arn or db_sub.get('tags') != tags:
                table.put_item(Item={
                    'user_id': user_id,
                    'notification_email': email,
                    'tags': tags,
                    'subscription_arn': sub_arn,
                    'updated_at': datetime.datetime.utcnow().isoformat() + 'Z'
                })
                
        synced_list.append({
            'email': email,
            'status': status,
            'tags': tags
        })
        
    return synced_list

def handle(event, context):
    logger.info("Received event: %s", json.dumps(event))
    
    method = event.get('requestContext', {}).get('http', {}).get('method', 'POST')
    path = event.get('requestContext', {}).get('http', {}).get('path', '/subscribe')
    user_id = get_user_id(event)
    
    if not user_id:
        return {
            'statusCode': 401,
            'body': json.dumps({'error': 'Unauthorized: Missing user identity'})
        }
    
    # Route for notifications
    if path == '/notifications':
        if method == 'GET':
            try:
                notifications_table_name = os.environ.get('NOTIFICATIONS_TABLE_NAME')
                if not notifications_table_name:
                    return {
                        'statusCode': 500,
                        'body': json.dumps({'error': 'Notifications table not configured'})
                    }
                notifications_table = dynamodb.Table(notifications_table_name)
                
                # Query notifications by user_id
                response = notifications_table.query(
                    KeyConditionExpression=Key('user_id').eq(user_id)
                )
                items = response.get('Items', [])
                
                formatted_notifs = []
                for item in items:
                    raw_s3_url = item.get('file_url')
                    http_url = None
                    if raw_s3_url and raw_s3_url.startswith('s3://'):
                        http_url = generate_presigned_url(raw_s3_url)
                        
                    formatted_notifs.append({
                        'id': item.get('notification_id'),
                        'title': item.get('title'),
                        'message': item.get('message'),
                        'read': bool(item.get('read', False)),
                        'timestamp': item.get('timestamp'),
                        'file_url': http_url or raw_s3_url,
                        'tag': item.get('tag')
                    })
                
                # Sort by timestamp descending
                formatted_notifs.sort(key=lambda x: x['timestamp'], reverse=True)
                
                return {
                    'statusCode': 200,
                    'body': json.dumps({'notifications': formatted_notifs})
                }
            except Exception as e:
                logger.error("Failed to query notifications: %s", str(e))
                return {
                    'statusCode': 500,
                    'body': json.dumps({'error': f'Failed to query notifications: {str(e)}'})
                }
        else:
            return {
                'statusCode': 405,
                'body': json.dumps({'error': 'Method not allowed'})
            }
                
    elif path == '/notifications/read':
        if method == 'POST':
            try:
                body = json.loads(event.get('body', '{}'))
            except json.JSONDecodeError:
                body = {}
                
            notification_id = body.get('notification_id')
            
            notifications_table_name = os.environ.get('NOTIFICATIONS_TABLE_NAME')
            if not notifications_table_name:
                return {
                    'statusCode': 500,
                    'body': json.dumps({'error': 'Notifications table not configured'})
                }
            notifications_table = dynamodb.Table(notifications_table_name)
            
            try:
                if notification_id:
                    # Mark a single notification as read
                    notifications_table.update_item(
                        Key={
                            'user_id': user_id,
                            'notification_id': notification_id
                        },
                        UpdateExpression="set #r = :r",
                        ExpressionAttributeNames={'#r': 'read'},
                        ExpressionAttributeValues={':r': True}
                    )
                else:
                    # Mark all notifications for this user as read
                    response = notifications_table.query(
                        KeyConditionExpression=Key('user_id').eq(user_id)
                    )
                    items = response.get('Items', [])
                    for item in items:
                        if not item.get('read'):
                            notifications_table.update_item(
                                Key={
                                    'user_id': user_id,
                                    'notification_id': item['notification_id']
                                },
                                UpdateExpression="set #r = :r",
                                ExpressionAttributeNames={'#r': 'read'},
                                ExpressionAttributeValues={':r': True}
                            )
                
                return {
                    'statusCode': 200,
                    'body': json.dumps({'message': 'Notifications marked as read'})
                }
            except Exception as e:
                logger.error("Failed to update notifications read status: %s", str(e))
                return {
                    'statusCode': 500,
                    'body': json.dumps({'error': f'Failed to update notifications: {str(e)}'})
                }
        else:
            return {
                'statusCode': 405,
                'body': json.dumps({'error': 'Method not allowed'})
            }
            
    if method == 'GET':
        try:
            subscriptions = sync_user_subscriptions(user_id)
            return {
                'statusCode': 200,
                'body': json.dumps({'subscriptions': subscriptions})
            }
        except Exception as e:
            logger.error("Failed to get subscriptions for user %s: %s", user_id, str(e))
            return {
                'statusCode': 500,
                'body': json.dumps({'error': f'Failed to fetch subscriptions: {str(e)}'})
            }

    elif method == 'POST':
        try:
            body = json.loads(event.get('body', '{}'))
        except json.JSONDecodeError:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Invalid JSON body'})
            }

        email = body.get('email')
        tags = body.get('tags', [])

        if not email:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Email is required'})
            }

        if not tags:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'At least one tag is required to subscribe'})
            }

        normalized_tags = [t.strip().lower() for t in tags if t.strip()]

        if not normalized_tags:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Valid tag strings are required'})
            }

        try:
            # Query DynamoDB to see if this user already has this email registered
            response = table.get_item(Key={'user_id': user_id, 'notification_email': email})
            db_sub = response.get('Item')
            
            filter_policy = {
                'tag': normalized_tags
            }

            sub_arn = db_sub.get('subscription_arn', '') if db_sub else ''
            
            # Verify live status if sub_arn exists (double check if it wasn't deleted in SNS)
            sns_subs = fetch_sns_subscriptions()
            sns_sub = next((s for s in sns_subs if s.get('Endpoint') == email), None)
            
            if sns_sub:
                sub_arn = sns_sub.get('SubscriptionArn', '')
            else:
                sub_arn = ''

            # Case 1: Subscription exists and is confirmed/verified
            if sub_arn and sub_arn != 'PendingConfirmation':
                logger.info("Updating verified subscription attributes for: %s", email)
                sns.set_subscription_attributes(
                    SubscriptionArn=sub_arn,
                    AttributeName='FilterPolicy',
                    AttributeValue=json.dumps(filter_policy)
                )
                
                # Update DynamoDB
                table.put_item(Item={
                    'user_id': user_id,
                    'notification_email': email,
                    'tags': normalized_tags,
                    'subscription_arn': sub_arn,
                    'updated_at': datetime.datetime.utcnow().isoformat() + 'Z'
                })
                
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'message': 'Subscription updated successfully.',
                        'status': 'verified',
                        'subscription_arn': sub_arn
                    })
                }
            
            # Case 2: Subscription is new or pending
            try:
                logger.info("Calling sns.subscribe for: %s", email)
                response = sns.subscribe(
                    TopicArn=SNS_TOPIC_ARN,
                    Protocol='email',
                    Endpoint=email,
                    Attributes={
                        'FilterPolicy': json.dumps(filter_policy)
                    }
                )
                
                new_sub_arn = response.get('SubscriptionArn', '')
                is_pending = new_sub_arn == 'pending confirmation'
                status = 'pending' if is_pending else 'verified'
                msg = 'Subscription updated successfully.' if status == 'verified' else 'Subscription request sent. Please check your email to confirm.'
                
                # Write to DynamoDB
                table.put_item(Item={
                    'user_id': user_id,
                    'notification_email': email,
                    'tags': normalized_tags,
                    'subscription_arn': 'PendingConfirmation' if is_pending else new_sub_arn,
                    'updated_at': datetime.datetime.utcnow().isoformat() + 'Z'
                })

                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'message': msg,
                        'status': status,
                        'subscription_arn': new_sub_arn
                    })
                }
            except Exception as sub_err:
                err_str = str(sub_err)
                if 'Subscription already exists with different attributes' in err_str:
                    return {
                        'statusCode': 400,
                        'body': json.dumps({
                            'error': 'A pending subscription with different tags already exists for this email. Please confirm it first or wait for it to expire.'
                        })
                    }
                raise sub_err
                
        except Exception as e:
            logger.error("Failed to create/update subscription: %s", str(e))
            return {
                'statusCode': 500,
                'body': json.dumps({'error': f'Failed to process subscription: {str(e)}'})
            }

    elif method == 'DELETE':
        try:
            # Extract email from query string parameter
            email = event.get('queryStringParameters', {}).get('email')
            
            if not email:
                # Fallback to request body if query string is empty
                body = json.loads(event.get('body', '{}'))
                email = body.get('email')
                
            if not email:
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': 'Email parameter is required for deletion'})
                }
                
            # Get the subscription item from DB to retrieve ARN
            response = table.get_item(Key={'user_id': user_id, 'notification_email': email})
            db_sub = response.get('Item')
            
            if not db_sub:
                return {
                    'statusCode': 404,
                    'body': json.dumps({'error': 'Subscription not found for this user'})
                }
                
            sub_arn = db_sub.get('subscription_arn', '')
            
            # Double check if it exists in SNS
            sns_subs = fetch_sns_subscriptions()
            sns_sub = next((s for s in sns_subs if s.get('Endpoint') == email), None)
            
            if sns_sub:
                sub_arn = sns_sub.get('SubscriptionArn', '')
                
            # Unsubscribe in SNS if confirmed (pending subscriptions cannot be unsubscribed by ARN)
            if sub_arn and sub_arn != 'PendingConfirmation' and sub_arn != 'pending confirmation':
                logger.info("Unsubscribing from SNS: %s", sub_arn)
                sns.unsubscribe(SubscriptionArn=sub_arn)
            else:
                logger.info("Unsubscribing: pending confirmation or not found in SNS. Deleting from DB only.")
                
            # Delete record in DynamoDB
            table.delete_item(Key={'user_id': user_id, 'notification_email': email})
            
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'Subscription deleted successfully'})
            }
        except Exception as e:
            logger.error("Failed to delete subscription for user %s: %s", user_id, str(e))
            return {
                'statusCode': 500,
                'body': json.dumps({'error': f'Failed to unsubscribe: {str(e)}'})
            }
    else:
        return {
            'statusCode': 405,
            'body': json.dumps({'error': 'Method not allowed'})
        }
