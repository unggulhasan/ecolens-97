"""Token Proxy Lambda — OAuth 2.0 token endpoint for EventBridge → GCP OIDC.

EventBridge calls this endpoint (via Function URL) to obtain a fresh GCP OIDC
token before each API Destination delivery. The function validates the caller
using a shared client secret, then mints a GCP-signed OIDC identity token
targeted at the Cloud Function URL.
"""

import json
import hmac
import logging
import os
import base64
import boto3
from google.oauth2 import service_account
from google.auth.transport.requests import Request

logger = logging.getLogger()
logger.setLevel(logging.INFO)

secrets = boto3.client("secretsmanager", region_name=os.environ.get("AWS_REGION", "ap-southeast-4"))

GCP_FUNCTION_URL = os.environ["GCP_FUNCTION_URL"]
SA_KEY_SECRET = os.environ["SA_KEY_SECRET"]           # e.g. prod/gcp/sa-key
CLIENT_ID = os.environ["CLIENT_ID"]                    # e.g. eventbridge-client
CLIENT_SECRET_NAME = os.environ["CLIENT_SECRET_NAME"]  # e.g. prod/eventbridge/client-secret


def get_secret(name: str) -> str:
    response = secrets.get_secret_value(SecretId=name)
    return response["SecretString"]


def parse_body(event: dict) -> dict:
    """Parse URL-encoded or JSON body from API Gateway / Function URL event."""
    body = event.get("body", "") or ""
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    result: dict = {}
    if body.startswith("{"):
        result = json.loads(body)
    else:
        for pair in body.split("&"):
            if "=" in pair:
                k, v = pair.split("=", 1)
                result[k] = v
    return result


def generate_oidc_token(sa_key_json: str) -> str:
    sa_info = json.loads(sa_key_json)
    credentials = service_account.IDTokenCredentials.from_service_account_info(
        sa_info,
        target_audience=GCP_FUNCTION_URL,
    )
    credentials.refresh(Request())
    return credentials.token


def handler(event, context):
    try:
        body = parse_body(event)

        # Validate grant type
        if body.get("grant_type") != "client_credentials":
            logger.warning("Rejected: unsupported grant_type '%s'", body.get("grant_type"))
            return {"statusCode": 400, "body": json.dumps({"error": "unsupported_grant_type"})}

        # Validate client_id
        if body.get("client_id") != CLIENT_ID:
            logger.warning("Rejected: unknown client_id")
            return {"statusCode": 401, "body": json.dumps({"error": "invalid_client"})}

        # Validate client_secret (constant-time comparison)
        expected_secret = get_secret(CLIENT_SECRET_NAME)
        presented_secret = body.get("client_secret", "")
        if not hmac.compare_digest(presented_secret, expected_secret):
            logger.warning("Rejected: invalid client_secret")
            return {"statusCode": 401, "body": json.dumps({"error": "invalid_client"})}

        # Generate GCP OIDC token
        sa_key_json = get_secret(SA_KEY_SECRET)
        oidc_token = generate_oidc_token(sa_key_json)

        logger.info("OIDC token generated successfully")
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "access_token": oidc_token,
                "token_type": "Bearer",
                "expires_in": 3600,
            }),
        }

    except Exception as e:
        logger.error("Token generation failed: %s", str(e))
        return {"statusCode": 500, "body": json.dumps({"error": "server_error"})}
