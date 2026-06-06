import json
import boto3
import os
from decimal import Decimal

dynamodb = boto3.resource('dynamodb', region_name=os.environ['AWS_REGION_NAME'])
table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])
tmp_table = dynamodb.Table(os.environ['TMP_TABLE_NAME'])  # tmp_query


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj)
        return super().default(obj)


def handler(event, context):
    """
    Query 4: Find files matching tags of a temporarily uploaded file.

    Input:  {"file_id": "uuid-of-tmp-uploaded-file"}
    Output: {"results": [...thumbnail_urls for images, file_urls for videos...]}

    Flow:
      1. Look up file_id in tmp_query table → get detected tags
      2. Scan main table for files matching ALL detected tags (AND logic)
      3. Return thumbnail URLs for images, full URLs for videos
      4. Tmp file is NOT stored in main table
    """
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid JSON body'})
        }

    file_id = body.get('file_id')

    if not file_id:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'file_id is required'})
        }

    # Step 1 — look up detected tags from tmp_query
    tmp_response = tmp_table.get_item(Key={'file_id': file_id})
    tmp_item = tmp_response.get('Item')

    if not tmp_item:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': 'Temporary file not found. It may still be processing.'})
        }

    detected_tags = tmp_item.get('tags', {})

    if not detected_tags:
        return {
            'statusCode': 200,
            'body': json.dumps({'results': [], 'detected_tags': []})
        }

    tag_names = list(detected_tags.keys())

    # Step 2 — scan main table for files matching ALL detected tags (AND logic)
    matching = []
    scan_kwargs = {}

    while True:
        response = table.scan(**scan_kwargs)
        items = response.get('Items', [])

        for item in items:
            item_tags = item.get('tags', {})
            match = all(
                item_tags.get(tag, 0) >= 1
                for tag in tag_names
            )
            if match:
                if item.get('file_type') == 'image':
                    url = item.get('thumbnail_url')
                else:
                    url = item.get('file_url')
                if url:
                    matching.append(url)

        last_key = response.get('LastEvaluatedKey')
        if not last_key:
            break
        scan_kwargs['ExclusiveStartKey'] = last_key

    return {
        'statusCode': 200,
        'body': json.dumps({
            'results': matching,
            'detected_tags': tag_names
        }, cls=DecimalEncoder)
    }