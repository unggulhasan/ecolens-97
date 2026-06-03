import json
import boto3
import os
from decimal import Decimal

dynamodb = boto3.resource('dynamodb', region_name=os.environ['AWS_REGION_NAME'])
table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])

def handler(event, context):
    # Input: {"urls": [...], "tags": ["koala", "dingo"], "operation": 1 or 0}
    body = json.loads(event.get('body', '{}'))
    urls = body.get('file_urls', [])
    tags = body.get('tags', [])
    operation = body.get('operation')

    if not urls or not tags or operation is None:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'urls, tags and operation are required'})
        }

    updated = []
    for url in urls:
        # Get existing item
        response = table.get_item(Key={'file_url': url})
        item = response.get('Item')

        if not item:
            continue

        existing_tags = item.get('tags', {})

        if operation == 1:
            # Add tags
            for tag in tags:
                if tag not in existing_tags:
                    existing_tags[tag] = Decimal(1)

        else:
            # Remove tags — ignore if not present
            for tag in tags:
                existing_tags.pop(tag, None)

        # Update the record
        table.update_item(
            Key={'file_url': url},
            UpdateExpression='SET tags = :tags',
            ExpressionAttributeValues={':tags': existing_tags}
        )

        # Return file URL + final tag state
        updated.append({
            'file_url': url,
            'final_tags': list(existing_tags.keys())
        })
        

    return {
        'statusCode': 200,
        'body': json.dumps({'updated': updated})
    }