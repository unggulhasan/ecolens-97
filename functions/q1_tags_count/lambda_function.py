import json
import boto3
import os
from decimal import Decimal

dynamodb = boto3.resource('dynamodb', region_name=os.environ['AWS_REGION_NAME'])
table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj)
        return super().default(obj)

def handler(event, context):
    # Get tags from request body
    # Example input: {"kangaroo": 2, "wombat": 1}
    body = json.loads(event.get('body', '{}'))
    
    if not body:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'No tags provided'})
        }
    
    # Scan the entire table
    response = table.scan()
    items = response['Items']
    
    matching = []
    for item in items:
        item_tags = item.get('tags', {})
        
        # Check ALL requested tags meet minimum count (AND logic)
        match = all(
            item_tags.get(tag, 0) >= Decimal(str(count))
            for tag, count in body.items()
        )
        
        if match:
            # Return thumbnail for images, full URL for videos
            if item.get('file_type') == 'image':
                matching.append(item.get('thumbnail_url'))
            else:
                matching.append(item.get('file_url'))
    
    return {
        'statusCode': 200,
        'body': json.dumps({'results': matching}, cls=DecimalEncoder)
    }