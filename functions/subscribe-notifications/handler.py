import json
import boto3
import os
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sns = boto3.client('sns', region_name=os.environ.get('AWS_REGION_NAME', 'ap-southeast-4'))
SNS_TOPIC_ARN = os.environ['SNS_TOPIC_ARN']

def find_subscription(email):
    next_token = ''
    while True:
        if next_token:
            response = sns.list_subscriptions_by_topic(TopicArn=SNS_TOPIC_ARN, NextToken=next_token)
        else:
            response = sns.list_subscriptions_by_topic(TopicArn=SNS_TOPIC_ARN)
            
        subscriptions = response.get('Subscriptions', [])
        for sub in subscriptions:
            if sub.get('Endpoint') == email:
                return sub
                
        next_token = response.get('NextToken')
        if not next_token:
            break
    return None

def handle(event, context):
    logger.info("Received event: %s", json.dumps(event))
    
    # Extract request method
    method = event.get('requestContext', {}).get('http', {}).get('method', 'POST')
    
    # Extract email from JWT authorizer claims or query string
    claims = event.get('requestContext', {}).get('authorizer', {}).get('jwt', {}).get('claims', {})
    email = claims.get('email')
    
    if method == 'GET':
        email = email or event.get('queryStringParameters', {}).get('email')
        if not email:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Email is required'})
            }
            
        try:
            logger.info("Checking subscription status for email: %s", email)
            sub = find_subscription(email)
            
            if not sub:
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'status': 'not_subscribed',
                        'email': email,
                        'tags': []
                    })
                }
                
            sub_arn = sub.get('SubscriptionArn', '')
            
            if sub_arn == 'PendingConfirmation':
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'status': 'pending',
                        'email': email,
                        'tags': []
                    })
                }
            
            # If confirmed, get subscription attributes to fetch current FilterPolicy tags
            logger.info("Subscription is active. Fetching attributes for ARN: %s", sub_arn)
            attrs_response = sns.get_subscription_attributes(SubscriptionArn=sub_arn)
            attributes = attrs_response.get('Attributes', {})
            
            filter_policy_str = attributes.get('FilterPolicy', '{}')
            filter_policy = json.loads(filter_policy_str)
            tags = filter_policy.get('tag', [])
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'status': 'verified',
                    'email': email,
                    'tags': tags,
                    'subscription_arn': sub_arn
                })
            }
            
        except Exception as e:
            logger.error("Failed to check subscription for %s: %s", email, str(e))
            return {
                'statusCode': 500,
                'body': json.dumps({'error': f'Failed to fetch subscription details: {str(e)}'})
            }

    elif method == 'POST':
        try:
            body = json.loads(event.get('body', '{}'))
        except json.JSONDecodeError:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Invalid JSON body'})
            }

        # POST payload email takes priority, fallback to JWT claims
        email = body.get('email') or email
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

        # Normalize tags to lowercase and trim spaces
        normalized_tags = [t.strip().lower() for t in tags if t.strip()]

        if not normalized_tags:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Valid tag strings are required'})
            }

        try:
            # Check existing subscription state
            logger.info("Checking if %s has an existing subscription", email)
            existing_sub = find_subscription(email)
            
            filter_policy = {
                'tag': normalized_tags
            }

            sub_arn = existing_sub.get('SubscriptionArn', '') if existing_sub else ''

            # If subscription is active/verified, update attributes directly
            if sub_arn and sub_arn != 'PendingConfirmation':
                logger.info("Updating existing active subscription %s with filter policy: %s", sub_arn, filter_policy)
                sns.set_subscription_attributes(
                    SubscriptionArn=sub_arn,
                    AttributeName='FilterPolicy',
                    AttributeValue=json.dumps(filter_policy)
                )
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'message': 'Subscription updated successfully.',
                        'status': 'verified',
                        'subscription_arn': sub_arn
                    })
                }

            # Otherwise, call subscribe to initiate validation or create new subscription
            try:
                logger.info("Subscribing %s to SNS Topic %s with filter policy: %s", email, SNS_TOPIC_ARN, filter_policy)
                response = sns.subscribe(
                    TopicArn=SNS_TOPIC_ARN,
                    Protocol='email',
                    Endpoint=email,
                    Attributes={
                        'FilterPolicy': json.dumps(filter_policy)
                    }
                )

                subscription_arn = response.get('SubscriptionArn', '')
                logger.info("Subscription response: %s", response)

                is_pending = subscription_arn == 'pending confirmation'
                status = 'pending' if is_pending else 'verified'
                msg = 'Subscription updated successfully.' if status == 'verified' else 'Subscription request sent. Please check your email to confirm.'

                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'message': msg,
                        'status': status,
                        'subscription_arn': subscription_arn
                    })
                }
            except Exception as sub_err:
                err_str = str(sub_err)
                if 'Subscription already exists with different attributes' in err_str:
                    return {
                        'statusCode': 400,
                        'body': json.dumps({
                            'error': 'A pending subscription with different tags already exists. Please verify your email first, or wait for it to expire.'
                        })
                    }
                raise sub_err

        except Exception as e:
            logger.error("Failed to subscribe %s to topic: %s", email, str(e))
            return {
                'statusCode': 500,
                'body': json.dumps({'error': f'Failed to process subscription: {str(e)}'})
            }
    else:
        return {
            'statusCode': 405,
            'body': json.dumps({'error': 'Method not allowed'})
        }
