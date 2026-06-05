import json
import os
import hmac

import functions_framework
import requests
from google.cloud import pubsub_v1


# Shared secret for validating requests from AWS EventBridge.
# Set via Cloud Function environment variable from GCP Secret Manager.
CALLBACK_SECRET = os.environ.get("CALLBACK_SECRET", "")

# Fixed topic name — must match the Terraform resource name in image_processor.tf.
# We derive the full topic path at cold start via the GCP metadata server so we
# don't need to inject it as an env var (which triggers a provider bug when mixed
# with secret_environment_variables).
_TOPIC_NAME = "aussie-ecolens-prod-image-inference-requests"


def _gcp_project_id() -> str:
    """Return the current GCP project ID via the instance metadata server."""
    resp = requests.get(
        "http://metadata.google.internal/computeMetadata/v1/project/project-id",
        headers={"Metadata-Flavor": "Google"},
        timeout=5,
    )
    resp.raise_for_status()
    return resp.text


# Resolved once at module load (cold start); empty until first request.
_IMAGE_TOPIC_ID: str = ""


def _get_topic_id() -> str:
    global _IMAGE_TOPIC_ID
    if not _IMAGE_TOPIC_ID:
        project = os.environ.get("GOOGLE_CLOUD_PROJECT") or _gcp_project_id()
        _IMAGE_TOPIC_ID = f"projects/{project}/topics/{_TOPIC_NAME}"
    return _IMAGE_TOPIC_ID

# Lazily-initialised module-level publisher so warm invocations skip the
# (relatively expensive) gRPC channel setup.
_publisher: pubsub_v1.PublisherClient | None = None


def _get_publisher() -> pubsub_v1.PublisherClient:
    global _publisher
    if _publisher is None:
        _publisher = pubsub_v1.PublisherClient()
    return _publisher


def _publish_image_inference(payload: dict) -> str:
    """Publish a JSON payload to the image inference topic. Returns the message ID."""
    topic_id = _get_topic_id()
    publisher = _get_publisher()
    data = json.dumps(payload).encode("utf-8")
    future = publisher.publish(topic_id, data=data)
    return future.result(timeout=10)


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
    if file_type == "image":
        try:
            payload = {
                "file_id":       file_id,
                "presigned_url": presigned_url,
                "file_type":     file_type,
                "job_type":      job_type,
            }
            message_id = _publish_image_inference(payload)
            print(f"[ACCEPT] Published image inference request to Pub/Sub: message_id={message_id}")
        except Exception as exc:
            # Log and surface a 500 so EventBridge retries — losing the job
            # silently is worse than a few retries.
            print(f"[ACCEPT] Failed to publish to Pub/Sub: {exc}")
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
