import json
import boto3
from datetime import datetime
from decimal import Decimal

dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-4')
table = dynamodb.Table('aussie-ecolens-prod-media')

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj)
        return super().default(obj)

def handle(event, context):
    # Write a test record
    table.put_item(Item={
        'file_url': 's3://test-bucket/test-image.jpg',
        'thumbnail_url': 's3://test-bucket/thumb-test-image.jpg',
        'file_type': 'image',
        'checksum': 'abc123',
        'tags': {'kangaroo': Decimal(2), 'wombat': Decimal(1)},
        'uploaded_at': datetime.utcnow().isoformat(),
        'user_id': 'michelle-test'
    })

    # Read it back
    response = table.get_item(Key={
        'file_url': 's3://test-bucket/test-image.jpg'
    })

    return {
        'statusCode': 200,
        'body': json.dumps(response['Item'], cls=DecimalEncoder)
    }