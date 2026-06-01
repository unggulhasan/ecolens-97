import json
import sys

try:
    import cv2
    opencv_status = f"Success! OpenCV version: {cv2.__version__}"
except ImportError as e:
    opencv_status = f"Failure! Cannot import cv2. Error: {str(e)}"

def handler(event, context):
    detail = event.get("detail", {})
    detail["opencv_status"] = opencv_status

    print(f"Received event: {json.dumps(event)}")
    
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(detail),
    }
