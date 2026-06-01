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
    # Input: {"species": ["dingo"]} or {"species": ["kangaroo", "wombat"]}
    body = json.loads(event.get('body', '{}'))
    species_list = body.get('species', [])

    if not species_list:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'No species provided'})
        }

    response = table.scan()
    items = response['Items']

    matching = []
    for item in items:
        item_tags = item.get('tags', {})
        # Just needs at least 1 of each species — no minimum count
        match = all(
            item_tags.get(species, 0) >= 1
            for species in species_list
        )
        if match:
            if item.get('file_type') == 'image':
                matching.append(item.get('thumbnail_url'))
            else:
                matching.append(item.get('file_url'))

    return {
        'statusCode': 200,
        'body': json.dumps({'results': matching}, cls=DecimalEncoder)
    }