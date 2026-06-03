import json
import boto3
import os
from decimal import Decimal
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource('dynamodb', region_name=os.environ['AWS_REGION_NAME'])
table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj)
        return super().default(obj)

def handler(event, context):
    # Input: {"thumbnail_url": "s3://..."}
    body = json.loads(event.get('body', '{}'))
    thumbnail_url = body.get('thumbnail_url')

    if not thumbnail_url:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'No thumbnail_url provided'})
        }

    # Scan for matching thumbnail URL
    response = table.scan(
        FilterExpression=Attr('thumbnail_url').eq(thumbnail_url)
    )
    items = response['Items']

    if not items:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': 'Thumbnail not found'})
        }

    return {
        'statusCode': 200,
        'body': json.dumps({'file_url': items[0]['file_url']}, cls=DecimalEncoder)
    }