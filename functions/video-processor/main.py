"""video-processor — Pub/Sub-triggered ONNX inference worker for videos.

Pipeline:
    accept_inference (HTTP)
        └── publishes JSON to video_inference_requests topic
                              │
                              ▼
    Eventarc → Cloud Run video-processor (this file)
        ├── 1. Decode Pub/Sub envelope
        ├── 2. Download video from presigned_url → /tmp/<job_id>/
        ├── 3. Extract frames at FRAME_FPS fps (max MAX_FRAMES) via FFmpeg
        ├── 4. Infer each frame with ThreadPoolExecutor(2)
        ├── 5. Aggregate tags (max count per species across frames)
        ├── 6. POST result directly to AWS API Gateway
               POST /inference-results  (X-Callback-Secret)
        └── 7. Clean up /tmp/<job_id>/

Incoming Pub/Sub data (after base64 decode):
    {
        "file_id":       "<uuid>",
        "presigned_url": "<https://s3...>",
        "file_type":     "video",
        "job_type":      "temporary" | "permanent"
    }

Result POST body (to AWS_RESULTS_URL):
    {
        "file_id":   "<uuid>",
        "result":    [{"koala": 3}, {"magpie": 1}],
        "file_type": "video",
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
import shutil
import tempfile
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import functions_framework
import requests
from cloudevents.http import CloudEvent
from PIL import Image

from aggregator import aggregate
from frame_extractor import extract_frames
from inference_service import download_video, run_inference_on_pil

# ─── Results callback ─────────────────────────────────────────────────────────
AWS_RESULTS_URL = os.environ.get("AWS_RESULTS_URL", "")
CALLBACK_SECRET = os.environ.get("CALLBACK_SECRET", "")

_MAX_ATTEMPTS = 3
_BACKOFF_BASE = 0.5   # seconds; doubles on each retry
_POST_TIMEOUT = 10    # seconds per attempt


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


# ─── Configuration (env-driven) ───────────────────────────────────────────────

FRAME_FPS  = float(os.environ.get("FRAME_FPS",   "1"))
MAX_FRAMES = int(os.environ.get("MAX_FRAMES",     "600"))
WORKERS    = 2   # ThreadPoolExecutor concurrency; matches CPU allocation in TF


# ─── Pub/Sub envelope decoding ────────────────────────────────────────────────

def _extract_payload(cloud_event: CloudEvent) -> dict[str, Any]:
    """Pull the JSON payload out of a Pub/Sub CloudEvent envelope."""
    data    = cloud_event.data or {}
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


# ─── Per-frame inference helper ───────────────────────────────────────────────

def _infer_frame(frame_path: Path) -> list[dict[str, int]]:
    """Open a frame JPEG and run ONNX inference. Returns per-frame result."""
    try:
        with Image.open(frame_path) as img:
            result = run_inference_on_pil(img)
        print(f"[FRAME] {frame_path.name}: {result}")
        return result
    finally:
        # Delete frame immediately after inference to keep /tmp usage flat.
        try:
            frame_path.unlink(missing_ok=True)
        except OSError:
            pass


# ─── Entry point ──────────────────────────────────────────────────────────────

@functions_framework.cloud_event
def process_video(cloud_event: CloudEvent) -> None:
    """Pub/Sub-triggered video inference entry point."""
    print(f"[PROCESS] video-processor start aws_results_url={AWS_RESULTS_URL!r}", flush=True)
    print(
        f"[PROCESS] Received CloudEvent type={cloud_event.get('type')} "
        f"id={cloud_event.get('id')}"
    )

    # ── Decode message ────────────────────────────────────────────────────────
    try:
        payload = _extract_payload(cloud_event)
    except ValueError as exc:
        # Malformed message — ACK immediately, don't retry.
        print(f"[PROCESS] Discarding malformed message: {exc}")
        return

    file_id       = payload.get("file_id")
    presigned_url = payload.get("presigned_url")
    file_type     = payload.get("file_type")
    job_type      = payload.get("job_type")

    print(f"[PROCESS] file_id={file_id} file_type={file_type} job_type={job_type}")

    if file_type != "video":
        print(f"[PROCESS] Skipping non-video payload (file_type={file_type!r})")
        return

    if not presigned_url or not str(presigned_url).startswith("http"):
        print(f"[PROCESS] Invalid presigned_url: {presigned_url!r} — discarding")
        return

    # ── Pipeline (exceptions bubble up → Pub/Sub retries) ────────────────────
    job_dir = Path(tempfile.gettempdir()) / f"vp-{uuid.uuid4().hex}"
    try:
        job_dir.mkdir(parents=True, exist_ok=True)
        frames_dir = job_dir / "frames"

        # 1. Download video
        video_path = download_video(presigned_url, job_dir)

        # 2. Extract frames via FFmpeg
        frame_paths = extract_frames(video_path, frames_dir, fps=FRAME_FPS, max_frames=MAX_FRAMES)

        if not frame_paths:
            print(f"[PROCESS] No frames extracted from video file_id={file_id}")
            result = []
        else:
            # 3. Parallel inference across frames with 2 workers
            per_frame_results: list[list[dict[str, int]]] = [None] * len(frame_paths)  # type: ignore[list-item]

            with ThreadPoolExecutor(max_workers=WORKERS) as executor:
                future_to_idx = {
                    executor.submit(_infer_frame, p): i
                    for i, p in enumerate(frame_paths)
                }
                for future in as_completed(future_to_idx):
                    idx = future_to_idx[future]
                    per_frame_results[idx] = future.result()   # re-raises on exception

            # 4. Aggregate (max count per species across frames)
            result = aggregate(per_frame_results)

        # 5. Log structured result
        output = {
            "file_id":   file_id,
            "result":    result,
            "file_type": file_type,
            "job_type":  job_type,
        }
        print(f"[PROCESS] RESULT {json.dumps(output)}")

        # 6. POST result directly to AWS API Gateway
        _post_result(output)

    finally:
        # 6. Clean up all temp files for this job
        try:
            shutil.rmtree(job_dir, ignore_errors=True)
            print(f"[PROCESS] Cleaned up {job_dir}")
        except Exception as exc:
            print(f"[PROCESS] Cleanup warning: {exc}")
