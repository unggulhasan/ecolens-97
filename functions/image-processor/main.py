"""image-processor — Pub/Sub-triggered ONNX inference worker.


    accept_inference (HTTP)
        ├── validates X-Callback-Secret
        └── publishes JSON to topic ──▶  image_processor (this file)
                                            ├── decodes Pub/Sub envelope
                                            ├── downloads image from presigned_url
                                            ├── runs ONNX inference (single pass)
                                            └── logs the structured result

Incoming Pub/Sub data (after base64 decode):
    {
        "file_id":       "<uuid>",
        "presigned_url": "<https://s3...>",
        "file_type":     "image",
        "job_type":      "temporary" | "permanent"
    }

Output (logged only, this iteration):
    {
        "file_id":   "<uuid>",
        "result":    [{"koala": 3}, {"magpie": 1}],
        "file_type": "image",
        "job_type":  "temporary"
    }
"""

from __future__ import annotations

import base64
import json
import traceback
from typing import Any

import functions_framework
from cloudevents.http import CloudEvent

from inference_service import run_inference


def _extract_payload(cloud_event: CloudEvent) -> dict[str, Any]:
    """Pull the JSON payload out of a Pub/Sub CloudEvent envelope.

    Eventarc → Pub/Sub CloudEvent shape:
        cloud_event.data = {
            "message": {
                "data": "<base64-encoded bytes>",
                "messageId": "...",
                "publishTime": "...",
                "attributes": {...}
            },
            "subscription": "..."
        }
    """
    data = cloud_event.data or {}
    message = data.get("message") or {}
    encoded = message.get("data")

    if not encoded:
        raise ValueError("CloudEvent message.data is missing or empty")

    try:
        decoded = base64.b64decode(encoded).decode("utf-8")
    except Exception as exc:
        raise ValueError(f"Failed to base64-decode Pub/Sub message: {exc}") from exc

    try:
        payload = json.loads(decoded)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Pub/Sub message is not valid JSON: {exc}") from exc

    if not isinstance(payload, dict):
        raise ValueError("Pub/Sub message JSON must be an object")

    return payload


@functions_framework.cloud_event
def process_image(cloud_event: CloudEvent) -> None:
    """Pub/Sub-triggered ONNX inference entry point."""
    print(f"[PROCESS] Received CloudEvent type={cloud_event.get('type')} id={cloud_event.get('id')}")

    try:
        payload = _extract_payload(cloud_event)
    except ValueError as exc:
        # Bad message — log and ACK (don't retry; malformed messages won't recover).
        print(f"[PROCESS] Discarding malformed message: {exc}")
        return

    file_id       = payload.get("file_id")
    presigned_url = payload.get("presigned_url")
    file_type     = payload.get("file_type")
    job_type      = payload.get("job_type")

    print(f"[PROCESS] file_id={file_id} file_type={file_type} job_type={job_type}")

    if file_type != "image":
        print(f"[PROCESS] Skipping non-image payload (file_type={file_type!r})")
        return

    if not isinstance(presigned_url, str) or not presigned_url.startswith("http"):
        print(f"[PROCESS] Discarding payload with invalid presigned_url for file_id={file_id}")
        return

    try:
        result = run_inference(presigned_url)
    except Exception:
        # Re-raise so Eventarc/Pub/Sub retries per RETRY_POLICY_RETRY.
        print(f"[PROCESS] Inference failed for file_id={file_id}")
        traceback.print_exc()
        raise

    response = {
        "file_id":   file_id,
        "result":    result,
        "file_type": file_type,
        "job_type":  job_type,
    }
    print(f"[PROCESS] RESULT {json.dumps(response)}")
