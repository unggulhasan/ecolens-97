import json
import os
import hmac

import functions_framework


# Shared secret for validating requests from AWS EventBridge.
# Set via Cloud Function environment variable from GCP Secret Manager.
CALLBACK_SECRET = os.environ.get("CALLBACK_SECRET", "")


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

    return {
        "message": "accepted",
        "received": {
            "file_id": request_json.get("file_id"),
            "presigned_url": request_json.get("presigned_url"),
        },
    }, 200, {"Content-Type": "application/json"}
