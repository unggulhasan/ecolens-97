# EventBridge → GCP Cloud Function: Shared Secret (callback_secret) Setup

## Architecture

AWS → GCP uses the **same `callback_secret`** as GCP → AWS. A single shared hex secret
stored in both AWS Secrets Manager and GCP Secret Manager. EventBridge injects it
as an `X-Callback-Secret` HTTP header via its API_KEY authorization type. The GCP
Cloud Function validates it with HMAC at the application level.

```
AWS                                       GCP
──────────────────────────────────────    ─────────────────────────────────────
EventBridge Connection (API_KEY auth)
  │
  │  POST accept-inference Cloud Function  (cross-cloud)
  │    X-Callback-Secret: <callback_secret>
  │                                         Function validates HMAC
  │                                         returns {"message": "accepted"}
```

No OIDC. No OAuth. No token exchange. No service account keys exchanged between clouds.
Just one shared secret, used symmetrically in both directions.

---

## Terraform deploy order

The `infra/` directory is split into four single-cloud root modules. You own the GCP
modules; your teammate runs only the AWS modules.

### Step 1 — Generate the shared callback secret (once)

```bash
CALLBACK_SECRET=$(openssl rand -hex 32)
echo "$CALLBACK_SECRET"   # save this; both sides need it
```

### Step 2 — You: apply GCP persistent resources

```bash
cd infra/persistent-gcp
terraform init
terraform apply -var="callback_secret=$CALLBACK_SECRET"
```

### Step 3 — You: apply GCP ephemeral resources

```bash
cd infra/ephemeral-gcp
terraform init
terraform apply
# Note the gcp_function_url output:
terraform output gcp_function_url
```

### Step 4 — Hand your teammate these two values

| Value | Source |
|---|---|
| `callback_secret` | The value from Step 1 |
| `gcp_function_url` | The `terraform output gcp_function_url` from Step 3 |

### Step 5 — Teammate: apply AWS persistent resources

```bash
cd infra/persistent-aws
terraform init
terraform apply \
  -var="media_bucket_name=<choose-a-name>" \
  -var="callback_secret=<value-from-step-1>"
```

### Step 6 — Teammate: apply AWS ephemeral resources

```bash
cd infra/ephemeral-aws
terraform init
terraform apply \
  -var="gcp_function_url=<value-from-step-3>" \
  -var="auth_secret=<frontend-auth-secret>"
```

---

## How it works

### AWS side

`infra/ephemeral-aws/eventbridge_gcp.tf` defines an EventBridge Connection with
`authorization_type = "API_KEY"`:

```hcl
resource "aws_cloudwatch_event_connection" "gcp_api_key" {
  authorization_type = "API_KEY"

  auth_parameters {
    api_key {
      key   = "X-Callback-Secret"
      value = local.persistent_state.callback_secret_value
    }
  }
}
```

EventBridge stores the secret in AWS Secrets Manager automatically and attaches
the `X-Callback-Secret` header to every request sent to the API Destination.

### GCP side

`functions/accept-inference/main.py` validates the header:

```python
CALLBACK_SECRET = os.environ.get("CALLBACK_SECRET", "")  # injected from GCP Secret Manager

def accept(request):
    presented = request.headers.get("X-Callback-Secret", "")
    if not hmac.compare_digest(presented, CALLBACK_SECRET):
        return {"status": "error", "message": "Unauthorized"}, 401
    return {"message": "accepted"}, 200
```

The `CALLBACK_SECRET` environment variable is injected via `secret_environment_variables`
in `infra/ephemeral-gcp/gcp_cloud_function.tf`, reading from `callback-secret` in
GCP Secret Manager (created by the persistent-gcp module).

### Symmetry with GCP → AWS

The same `callback_secret` is used when GCP orchestrator calls back to AWS.
This makes the auth pattern identical in both directions — a shared secret
validated by HMAC.

---

## Verification

```bash
# Without the secret — should return 401
curl -i https://<gcp-function-url>

# With the correct secret — should return 200
curl -i \
  -H "X-Callback-Secret: <callback_secret>" \
  -H "Content-Type: application/json" \
  -d '{"file_id": "test-123", "presigned_url": "https://example.com/test"}' \
  https://<gcp-function-url>

# With a wrong secret — should return 401
curl -i \
  -H "X-Callback-Secret: wrong-secret" \
  https://<gcp-function-url>
```

Check GCP Cloud Function logs for `[ACCEPT]` messages confirming validation.

---

## What was removed (compared to the old OIDC approach)

| Removed | Reason |
|---|---|
| Token Proxy Lambda (`functions/token-proxy/`) | No longer needed — no OAuth token exchange |
| GCP SA key in AWS Secrets Manager (`prod/gcp/sa-key`) | No longer needed — no OIDC token signing |
| EventBridge client secret (`prod/eventbridge/client-secret`) | Replaced by `callback_secret` via API_KEY |
| `gcloud iam service-accounts keys create` | No SA key to export |
| `eventbridge-invoker` GCP service account | No longer needed for function-level IAM |
| OAuth connection config in EventBridge | Replaced by simpler API_KEY auth |
| `iamcredentials.googleapis.com` | No OIDC token generation needed |
