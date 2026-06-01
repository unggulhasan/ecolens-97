import json


def handler(event, context):
    detail = event.get("detail", {})
    print(json.dumps(detail))

    return {"status": "ok"}
