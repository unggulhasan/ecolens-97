import json
import os
import hmac

import functions_framework
import requests
from google.cloud import pubsub_v1


# Shared secret for validating requests from AWS EventBridge.
# Set via Cloud Function environment variable from GCP Secret Manager.
CALLBACK_SECRET = os.environ.get("CALLBACK_SECRET", "")

# Fixed topic names — must match the Terraform resource names in image/video_processor.tf.
# Derived at cold start via the GCP metadata server to avoid Terraform provider bug
# when mixing environment_variables + secret_environment_variables.
_IMAGE_TOPIC_NAME = "aussie-ecolens-prod-image-inference-requests"
_VIDEO_TOPIC_NAME = "aussie-ecolens-prod-video-inference-requests"


def _gcp_project_id() -> str:
    """Return the current GCP project ID via the instance metadata server."""
    resp = requests.get(
        "http://metadata.google.internal/computeMetadata/v1/project/project-id",
        headers={"Metadata-Flavor": "Google"},
        timeout=5,
    )
    resp.raise_for_status()
    return resp.text


def _get_project() -> str:
    return os.environ.get("GOOGLE_CLOUD_PROJECT") or _gcp_project_id()


# Resolved once at cold start.
_IMAGE_TOPIC_ID: str = ""
_VIDEO_TOPIC_ID: str = ""


def _get_image_topic_id() -> str:
    global _IMAGE_TOPIC_ID
    if not _IMAGE_TOPIC_ID:
        _IMAGE_TOPIC_ID = f"projects/{_get_project()}/topics/{_IMAGE_TOPIC_NAME}"
    return _IMAGE_TOPIC_ID


def _get_video_topic_id() -> str:
    global _VIDEO_TOPIC_ID
    if not _VIDEO_TOPIC_ID:
        _VIDEO_TOPIC_ID = f"projects/{_get_project()}/topics/{_VIDEO_TOPIC_NAME}"
    return _VIDEO_TOPIC_ID

# Lazily-initialised module-level publisher so warm invocations skip the
# (relatively expensive) gRPC channel setup.
_publisher: pubsub_v1.PublisherClient | None = None


def _get_publisher() -> pubsub_v1.PublisherClient:
    global _publisher
    if _publisher is None:
        _publisher = pubsub_v1.PublisherClient()
    return _publisher


def _publish(topic_id: str, payload: dict) -> str:
    """Publish a JSON payload to a Pub/Sub topic. Returns the message ID."""
    publisher = _get_publisher()
    data = json.dumps(payload).encode("utf-8")
    future = publisher.publish(topic_id, data=data)
    return future.result(timeout=10)


def _publish_image_inference(payload: dict) -> str:
    return _publish(_get_image_topic_id(), payload)


def _publish_video_inference(payload: dict) -> str:
    return _publish(_get_video_topic_id(), payload)


@functions_framework.http
def accept(request):
    """Accept inference requests from AWS EventBridge.

    Validates the X-Callback-Secret header using HMAC to ensure
    only EventBridge (which holds the shared callback_secret) can
    invoke this function.
    """
    # Log full incoming request for debugging
    print("[ACCEPT] === Incoming Request ===")
    print(f"[ACCEPT] Method: {request.method}")
    print(f"[ACCEPT] URL: {request.url}")
    print(f"[ACCEPT] Headers: {dict(request.headers)}")
    print(f"[ACCEPT] Body: {request.get_data(as_text=True)}")
    print("[ACCEPT] === End Request ===")

    # Validate the callback secret
    presented = request.headers.get("X-Callback-Secret", "")
    expected = CALLBACK_SECRET
    if not expected:
        print("[ACCEPT] CALLBACK_SECRET env var is not set — rejecting request")
        return {"status": "error", "message": "Server misconfigured"}, 500, {"Content-Type": "application/json"}

    if not hmac.compare_digest(presented, expected):
        print("[ACCEPT] Invalid or missing X-Callback-Secret header")
        return {"status": "error", "message": "Unauthorized"}, 401, {"Content-Type": "application/json"}

    print("[ACCEPT] Callback secret validated successfully")

    # Parse JSON body from EventBridge
    request_json = request.get_json(silent=True) or {}

    file_id       = request_json.get("file_id")
    presigned_url = request_json.get("presigned_url")
    file_type     = request_json.get("file_type")
    job_type      = request_json.get("job_type")

    # Fan out to the appropriate worker via Pub/Sub.  Returning 200 quickly
    # is important — EventBridge treats anything else as a retryable failure.
    message_id: str | None = None
    _payload = {
        "file_id":       file_id,
        "presigned_url": presigned_url,
        "file_type":     file_type,
        "job_type":      job_type,
    }

    if file_type == "image":
        publish_fn = _publish_image_inference
        label = "image"
    elif file_type == "video":
        publish_fn = _publish_video_inference
        label = "video"
    else:
        publish_fn = None
        label = None

    if publish_fn is not None:
        try:
            message_id = publish_fn(_payload)
            print(f"[ACCEPT] Published {label} inference request to Pub/Sub: message_id={message_id}")
        except Exception as exc:
            print(f"[ACCEPT] Failed to publish {label} to Pub/Sub: {exc}")
            return {"status": "error", "message": "Failed to enqueue inference"}, 500, {
                "Content-Type": "application/json"
            }
    else:
        print(f"[ACCEPT] file_type={file_type!r} not yet routed; accepted but not enqueued")

    return {
        "message": "accepted",
        "received": {
            "file_id":      file_id,
            "presigned_url": presigned_url,
            "file_type":    file_type,
            "job_type":     job_type,
        },
        "enqueued":   file_type == "image" and message_id is not None,
        "message_id": message_id,
    }, 200, {"Content-Type": "application/json"}
