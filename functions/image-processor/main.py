"""image-processor — Pub/Sub-triggered ONNX inference worker.

Pipeline:
    accept_inference (HTTP)
        ├── validates X-Callback-Secret
        └── publishes JSON to topic ──▶  image_processor (this file)
                                            ├── decodes Pub/Sub envelope
                                            ├── downloads image from presigned_url
                                            ├── runs ONNX inference (single pass)
                                            └── POSTs result directly to AWS API Gateway
                                                POST /inference-results  (X-Callback-Secret)

Incoming Pub/Sub data (after base64 decode):
    {
        "file_id":       "<uuid>",
        "presigned_url": "<https://s3...>",
        "file_type":     "image",
        "job_type":      "temporary" | "permanent"
    }

Result POST body (to AWS_RESULTS_URL):
    {
        "file_id":   "<uuid>",
        "result":    [{"koala": 3}, {"magpie": 1}],
        "file_type": "image",
        "job_type":  "temporary"
    }

Environment variables:
    AWS_RESULTS_URL   — full URL, e.g. https://<id>.execute-api.<region>.amazonaws.com/inference-results
    CALLBACK_SECRET   — shared HMAC secret (injected from GCP Secret Manager)
"""

from __future__ import annotations

import base64
import json
import os
import time
import traceback
from typing import Any

import functions_framework
import requests
from cloudevents.http import CloudEvent

from inference_service import run_inference

# ─── Results callback ─────────────────────────────────────────────────────────
AWS_RESULTS_URL = os.environ.get("AWS_RESULTS_URL", "")
CALLBACK_SECRET = os.environ.get("CALLBACK_SECRET", "")

_MAX_ATTEMPTS  = 3
_BACKOFF_BASE  = 0.5   # seconds; doubles on each retry
_POST_TIMEOUT  = 10    # seconds per attempt


def _post_result(payload: dict) -> None:
    """POST an inference result directly to AWS API Gateway with retry.

    Retry policy (3 attempts, exponential backoff 0.5 → 1 → 2 s):
      - RequestException / 429 / 5xx  → retry
      - 2xx                           → success, return
      - 4xx (except 429)              → permanent failure, log and return
    """
    if not AWS_RESULTS_URL:
        print("[PROCESS] ERROR: AWS_RESULTS_URL is not set — cannot deliver result", flush=True)
        return
    if not CALLBACK_SECRET:
        print("[PROCESS] ERROR: CALLBACK_SECRET is not set — cannot deliver result", flush=True)
        return

    file_id = payload.get("file_id", "<unknown>")
    headers = {
        "Content-Type": "application/json",
        "X-Callback-Secret": CALLBACK_SECRET,
    }
    last_exc: Exception | None = None
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            resp = requests.post(
                AWS_RESULTS_URL,
                json=payload,
                headers=headers,
                timeout=_POST_TIMEOUT,
            )
        except requests.exceptions.RequestException as exc:
            last_exc = exc
            delay = _BACKOFF_BASE * (2 ** (attempt - 1))
            print(
                f"[PROCESS] POST attempt {attempt}/{_MAX_ATTEMPTS} failed (network): {exc} "
                f"— retrying in {delay:.1f}s",
                flush=True,
            )
            time.sleep(delay)
            continue

        status = resp.status_code
        if 200 <= status < 300:
            print(f"[PROCESS] Posted result to AWS file_id={file_id} status={status}", flush=True)
            return

        if status == 429 or status >= 500:
            delay = _BACKOFF_BASE * (2 ** (attempt - 1))
            print(
                f"[PROCESS] POST attempt {attempt}/{_MAX_ATTEMPTS} transient status={status} "
                f"— retrying in {delay:.1f}s",
                flush=True,
            )
            last_exc = RuntimeError(f"status={status} body={resp.text[:200]}")
            time.sleep(delay)
            continue

        # Permanent 4xx — log and give up
        print(
            f"[PROCESS] POST permanent failure file_id={file_id} status={status}: "
            f"{resp.text[:200]} — giving up",
            flush=True,
        )
        return

    print(
        f"[PROCESS] All {_MAX_ATTEMPTS} POST attempts exhausted for file_id={file_id}: "
        f"{last_exc} — inference result lost",
        flush=True,
    )


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
    print(f"[PROCESS] image-processor start aws_results_url={AWS_RESULTS_URL!r}", flush=True)
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
    import sys
    print(f"[PROCESS] RESULT {json.dumps(response)}", flush=True)

    _post_result(response)
