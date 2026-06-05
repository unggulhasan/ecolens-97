# EventBridge → GCP Cloud Run: OAuth 2.0 + OIDC Setup Guide

## Important distinction upfront

Throughout this guide, two GCP authentication mechanisms appear. They are different things:

**Cloud Run native auth** (`--no-allow-unauthenticated`) — Cloud Run validates the OIDC token itself at the service boundary. No Load Balancer required. The `target_audience` in your token request is the Cloud Run service URL. This is what this guide implements — it is appropriate for the assignment.

**True GCP IAP (Identity-Aware Proxy)** — A separate Google-managed proxy that sits in front of a Load Balancer. Requires an OAuth consent screen, an OAuth 2.0 client ID, and a Serverless NEG wired to a Load Balancer. The `target_audience` is the IAP OAuth client ID, not the Cloud Run URL. This is a production pattern that adds meaningful cost and complexity without improving the rubric score.

Both enforce the same security guarantee: only a caller holding a valid OIDC token signed for your specific service account can reach Cloud Run.

---

## Terraform deploy order

The `infra/` directory is split into four single-cloud root modules. You own the GCP modules; your teammate runs only the AWS modules.

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

### Step 4 — Hand your teammate these three values

| Value | Source |
|---|---|
| `gcp_sa_key_json` | Contents of `sa-key.json` (the service account key file) |
| `callback_secret` | The value from Step 1 |
| `gcp_function_url` | The `terraform output gcp_function_url` from Step 3 |

### Step 5 — Teammate: apply AWS persistent resources

```bash
cd infra/persistent-aws
terraform init
terraform apply \
  -var="media_bucket_name=<choose-a-name>" \
  -var="gcp_sa_key_json=$(cat /path/to/sa-key.json)" \
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

## Architecture summary

```
AWS                                       GCP
──────────────────────────────────────    ─────────────────────────────────────
EventBridge Connection (OAuth config)
  │
  │ ① POST /token  (intra-AWS)
  ▼
Token Proxy Lambda (Function URL)
  │
  │ ② POST iamcredentials.googleapis.com  (cross-cloud)
  │                                         signs OIDC ID token for Cloud Run
  │ ③ OIDC token returned  ◄───────────────────────────────────────────────────
  │
  │ ④ returns {"access_token": "<oidc_token>"}  (intra-AWS)
  ▼
EventBridge caches token, fires event
  │
  │ ⑤ POST Cloud Run URL                  (cross-cloud)
  │    Authorization: Bearer <oidc_token>
  │                                         Cloud Run validates token
  │                                         processes inference request
```

---

## Prerequisites

- AWS CLI configured (`aws configure`)
- `gcloud` CLI installed and authenticated (`gcloud auth login`)
- Python 3.11
- A GCP project with billing enabled
- An S3 bucket that will trigger the pipeline

---

## Part 1 — GCP Setup

### 1.1 Enable required APIs

These APIs must be enabled before any other GCP step. Some are off by default.

```bash
gcloud config set project YOUR_PROJECT_ID

gcloud services enable \
  run.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com
```

`iamcredentials.googleapis.com` is the one most commonly forgotten. Without it, the Token Proxy Lambda will get a 403 when trying to generate the OIDC token.

### 1.2 Create the service account

This service account represents EventBridge's identity inside GCP. Give it a descriptive name.

```bash
gcloud iam service-accounts create eventbridge-invoker \
  --display-name="EventBridge Cloud Run Invoker" \
  --description="Used by AWS EventBridge to invoke Cloud Run via OIDC"
```

Verify it was created:

```bash
gcloud iam service-accounts list --filter="email:eventbridge-invoker"
```

Note the full email — you will use it in several places:

```
eventbridge-invoker@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### 1.3 Download the service account key

The key is a JSON file that the Token Proxy Lambda uses to sign OIDC tokens. Treat it like a password — it grants GCP access.

```bash
gcloud iam service-accounts keys create ./sa-key.json \
  --iam-account=eventbridge-invoker@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

Do not commit `sa-key.json` to git. Do not put it in your Lambda's deployment package. You will upload it to AWS Secrets Manager in Part 2 and delete the local file after.

### 1.4 Deploy Cloud Run

If your inference service is not yet deployed, deploy it with authentication enforced:

```bash
gcloud run deploy inference-service \
  --image gcr.io/YOUR_PROJECT_ID/inference:latest \
  --platform managed \
  --region australia-southeast1 \
  --no-allow-unauthenticated \
  --memory 2Gi \
  --timeout 900
```

`--no-allow-unauthenticated` is the critical flag. It tells Cloud Run to reject any request that does not carry a valid Google-signed OIDC token.

After deployment, note the service URL exactly — including no trailing slash:

```
https://inference-service-HASH-ts.a.run.app
```

This URL is your `target_audience` when generating OIDC tokens. It must match exactly.

### 1.5 Grant the service account Cloud Run Invoker permission

This binding allows the service account to call the Cloud Run service:

```bash
gcloud run services add-iam-policy-binding inference-service \
  --region=australia-southeast1 \
  --member="serviceAccount:eventbridge-invoker@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

Verify the binding:

```bash
gcloud run services get-iam-policy inference-service \
  --region=australia-southeast1
```

You should see your service account listed under `roles/run.invoker`.

### 1.6 Confirm Cloud Run rejects unauthenticated requests

Before moving to AWS, confirm the protection is active:

```bash
# This should return 403
curl -i https://inference-service-HASH-ts.a.run.app

# This should return 200 (using your personal gcloud identity)
curl -i \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  https://inference-service-HASH-ts.a.run.app/health
```

If the unauthenticated request returns 200, the service is still public. Re-check the `--no-allow-unauthenticated` flag.

---

## Part 2 — AWS Setup: Token Proxy Lambda

The Token Proxy is a Lambda function that acts as an OAuth 2.0 token endpoint. EventBridge calls it to get a fresh OIDC token before each API Destination delivery. The function has one job: receive `client_credentials` grant, validate the caller, generate a GCP OIDC token, return it in OAuth 2.0 format.

### 2.1 Store secrets in AWS Secrets Manager

Do this before writing any Lambda code — the code reads from Secrets Manager, not environment variables.

**Store the GCP service account key:**

```bash
aws secretsmanager create-secret \
  --name "prod/gcp/sa-key" \
  --description "GCP service account key for EventBridge OIDC token generation" \
  --secret-string file://./sa-key.json \
  --region ap-southeast-2
```

**Store the EventBridge client secret** (the credential EventBridge presents to the Token Proxy):

```bash
# Generate a strong random secret
python3 -c "import secrets; print(secrets.token_hex(32))"
# Copy the output, then:

aws secretsmanager create-secret \
  --name "prod/eventbridge/client-secret" \
  --description "Client secret that EventBridge presents to the Token Proxy" \
  --secret-string "PASTE_THE_HEX_STRING_HERE" \
  --region ap-southeast-2
```

After uploading, delete the local key file:

```bash
rm ./sa-key.json
```

Note the ARNs of both secrets — you will need them for the Lambda IAM policy.

### 2.2 Create the Lambda deployment package

**Directory structure:**

```
token-proxy/
├── handler.py
└── requirements.txt
```

**`requirements.txt`:**

```
google-auth==2.29.0
google-auth-httplib2==0.2.0
requests==2.31.0
cachetools==5.3.3
pyasn1==0.6.0
pyasn1-modules==0.4.0
rsa==4.9
```

**`handler.py`:**

```python
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

secrets = boto3.client("secretsmanager", region_name="ap-southeast-2")

CLOUD_RUN_URL   = os.environ["CLOUD_RUN_URL"]    # e.g. https://inference-service-hash.a.run.app
SA_KEY_SECRET   = os.environ["SA_KEY_SECRET"]    # e.g. prod/gcp/sa-key
CLIENT_ID       = os.environ["CLIENT_ID"]         # e.g. eventbridge-client
CLIENT_SECRET_NAME = os.environ["CLIENT_SECRET_NAME"]  # e.g. prod/eventbridge/client-secret


def get_secret(name: str) -> str:
    response = secrets.get_secret_value(SecretId=name)
    return response["SecretString"]


def parse_body(event: dict) -> dict:
    """Parse URL-encoded or JSON body from API Gateway / Function URL event."""
    body = event.get("body", "") or ""
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    result = {}
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
        target_audience=CLOUD_RUN_URL   # must match Cloud Run URL exactly
    )
    credentials.refresh(Request())
    return credentials.token


def handler(event, context):
    try:
        body = parse_body(event)

        # Validate grant type — reject anything other than client_credentials
        if body.get("grant_type") != "client_credentials":
            logger.warning("Rejected: unsupported grant_type '%s'", body.get("grant_type"))
            return {"statusCode": 400, "body": json.dumps({"error": "unsupported_grant_type"})}

        # Validate client_id
        if body.get("client_id") != CLIENT_ID:
            logger.warning("Rejected: unknown client_id")
            return {"statusCode": 401, "body": json.dumps({"error": "invalid_client"})}

        # Validate client_secret using constant-time comparison (prevents timing attacks)
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
                "expires_in": 3600    # GCP OIDC tokens are valid for 1 hour
            })
        }

    except Exception as e:
        logger.error("Token generation failed: %s", str(e))
        return {"statusCode": 500, "body": json.dumps({"error": "server_error"})}
```

**Package the dependencies:**

```bash
cd token-proxy
pip install -r requirements.txt -t ./package/
cp handler.py ./package/
cd package
zip -r ../token-proxy.zip .
cd ..
```

### 2.3 Create the Lambda IAM execution role

```bash
# Create the role
aws iam create-role \
  --role-name token-proxy-lambda-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach basic Lambda execution policy (CloudWatch logs)
aws iam attach-role-policy \
  --role-name token-proxy-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Attach Secrets Manager read access (scoped to only the two secrets)
aws iam put-role-policy \
  --role-name token-proxy-lambda-role \
  --policy-name secrets-read \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": [
        "arn:aws:secretsmanager:ap-southeast-2:YOUR_ACCOUNT_ID:secret:prod/gcp/sa-key*",
        "arn:aws:secretsmanager:ap-southeast-2:YOUR_ACCOUNT_ID:secret:prod/eventbridge/client-secret*"
      ]
    }]
  }'
```

Replace `YOUR_ACCOUNT_ID` with your 12-digit AWS account ID (`aws sts get-caller-identity --query Account --output text`).

### 2.4 Deploy the Lambda

```bash
ROLE_ARN=$(aws iam get-role --role-name token-proxy-lambda-role --query Role.Arn --output text)

aws lambda create-function \
  --function-name token-proxy \
  --runtime python3.11 \
  --handler handler.handler \
  --role "$ROLE_ARN" \
  --zip-file fileb://token-proxy.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables="{
    CLOUD_RUN_URL=https://inference-service-HASH-ts.a.run.app,
    SA_KEY_SECRET=prod/gcp/sa-key,
    CLIENT_ID=eventbridge-client,
    CLIENT_SECRET_NAME=prod/eventbridge/client-secret
  }" \
  --region ap-southeast-2
```

### 2.5 Expose the Lambda via Function URL

```bash
aws lambda create-function-url-config \
  --function-name token-proxy \
  --auth-type NONE \
  --region ap-southeast-2
```

The URL is publicly accessible by design — this is how all OAuth 2.0 token endpoints work. The `client_secret` in the request body provides the actual protection. A caller without it receives a 401.

Retrieve the URL:

```bash
aws lambda get-function-url-config \
  --function-name token-proxy \
  --query FunctionUrl \
  --output text \
  --region ap-southeast-2
```

Note this URL — it goes into the EventBridge Connection in the next step.

### 2.6 Verify the Token Proxy manually

Before configuring EventBridge, confirm the endpoint works:

```bash
# Should return {"error": "invalid_client"}
curl -X POST https://YOUR-LAMBDA-URL.lambda-url.ap-southeast-2.on.aws/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=eventbridge-client&client_secret=WRONG"

# Should return {"access_token": "eyJ...", "token_type": "Bearer", "expires_in": 3600}
curl -X POST https://YOUR-LAMBDA-URL.lambda-url.ap-southeast-2.on.aws/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=eventbridge-client&client_secret=YOUR_ACTUAL_SECRET"
```

If the second call returns an OIDC token, the cross-cloud connection is working.

---

## Part 3 — AWS Setup: EventBridge

### 3.1 Create the Connection

The Connection holds your Token Proxy credentials. EventBridge reads them, calls the token endpoint before each delivery, and injects the returned token into the API Destination call automatically.

```bash
aws events create-connection \
  --name gcp-cloud-run-connection \
  --authorization-type OAUTH_CLIENT_CREDENTIALS \
  --auth-parameters '{
    "OAuthParameters": {
      "ClientParameters": {
        "ClientID": "eventbridge-client",
        "ClientSecret": "YOUR_CLIENT_SECRET_HEX_STRING"
      },
      "AuthorizationEndpoint": "https://YOUR-LAMBDA-URL.lambda-url.ap-southeast-2.on.aws/",
      "HttpMethod": "POST",
      "OAuthHttpParameters": {
        "BodyParameters": [
          {
            "Key": "grant_type",
            "Value": "client_credentials",
            "IsValueSecret": false
          }
        ]
      }
    }
  }' \
  --region ap-southeast-2
```

Note the Connection ARN from the output — you need it for the API Destination.

### 3.2 Create the API Destination

The API Destination links the Connection to the Cloud Run endpoint.

```bash
CONNECTION_ARN=$(aws events describe-connection \
  --name gcp-cloud-run-connection \
  --query ConnectionArn \
  --output text \
  --region ap-southeast-2)

aws events create-api-destination \
  --name gcp-inference-destination \
  --connection-arn "$CONNECTION_ARN" \
  --invocation-endpoint "https://inference-service-HASH-ts.a.run.app/infer" \
  --http-method POST \
  --invocation-rate-limit-per-second 10 \
  --region ap-southeast-2
```

`invocation-rate-limit-per-second` throttles how fast EventBridge sends events to Cloud Run. 10 per second is appropriate for assignment scale.

### 3.3 Create an IAM role for EventBridge to invoke the API Destination

```bash
aws iam create-role \
  --role-name eventbridge-api-destination-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "events.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam put-role-policy \
  --role-name eventbridge-api-destination-role \
  --policy-name invoke-api-destination \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "events:InvokeApiDestination",
      "Resource": "arn:aws:events:ap-southeast-2:YOUR_ACCOUNT_ID:api-destination/gcp-inference-destination/*"
    }]
  }'
```

### 3.4 Create a Dead Letter Queue

EventBridge needs a DLQ before the rule can be created. Create the SQS queue first:

```bash
aws sqs create-queue \
  --queue-name eventbridge-dlq \
  --region ap-southeast-2
```

Note the queue ARN:

```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.ap-southeast-2.amazonaws.com/YOUR_ACCOUNT_ID/eventbridge-dlq \
  --attribute-names QueueArn \
  --query Attributes.QueueArn \
  --output text \
  --region ap-southeast-2
```

### 3.5 Create the EventBridge Rule

This rule matches S3 object creation events from your bucket and routes them to the API Destination.

First, retrieve the API Destination ARN and the role ARN:

```bash
DEST_ARN=$(aws events describe-api-destination \
  --name gcp-inference-destination \
  --query ApiDestinationArn \
  --output text \
  --region ap-southeast-2)

ROLE_ARN=$(aws iam get-role \
  --role-name eventbridge-api-destination-role \
  --query Role.Arn \
  --output text)

DLQ_ARN="arn:aws:sqs:ap-southeast-2:YOUR_ACCOUNT_ID:eventbridge-dlq"
```

Create the rule:

```bash
aws events put-rule \
  --name s3-upload-to-gcp-inference \
  --event-pattern '{
    "source": ["aws.s3"],
    "detail-type": ["Object Created"],
    "detail": {
      "bucket": {
        "name": ["YOUR_BUCKET_NAME"]
      }
    }
  }' \
  --state ENABLED \
  --region ap-southeast-2
```

Add the API Destination as the target with an input transformer and retry policy:

```bash
aws events put-targets \
  --rule s3-upload-to-gcp-inference \
  --targets "[
    {
      \"Id\": \"gcp-inference-target\",
      \"Arn\": \"$DEST_ARN\",
      \"RoleArn\": \"$ROLE_ARN\",
      \"InputTransformer\": {
        \"InputPathsMap\": {
          \"bucket\": \"$.detail.bucket.name\",
          \"key\":    \"$.detail.object.key\"
        },
        \"InputTemplate\": \"{\\\"bucket\\\": \\\"<bucket>\\\", \\\"key\\\": \\\"<key>\\\"}\"
      },
      \"RetryPolicy\": {
        \"MaximumRetryAttempts\": 10,
        \"MaximumEventAgeInSeconds\": 3600
      },
      \"DeadLetterConfig\": {
        \"Arn\": \"$DLQ_ARN\"
      }
    }
  ]" \
  --region ap-southeast-2
```

The input transformer strips the verbose S3 event down to just `{"bucket": "...", "key": "..."}` before sending it to Cloud Run.

---

## Part 4 — Verification

### End-to-end test

Upload a file to the S3 bucket and watch the pipeline:

```bash
aws s3 cp ./test-image.jpg s3://YOUR_BUCKET_NAME/uploads/test-image.jpg
```

**Check EventBridge delivered the event:**

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Events \
  --metric-name Invocations \
  --dimensions Name=RuleName,Value=s3-upload-to-gcp-inference \
  --start-time $(date -u -v-5M +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region ap-southeast-2
```

**Check for failed deliveries (DLQ):**

```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.ap-southeast-2.amazonaws.com/YOUR_ACCOUNT_ID/eventbridge-dlq \
  --attribute-names ApproximateNumberOfMessages \
  --region ap-southeast-2
```

A non-zero message count means something failed — read the DLQ message for the failure reason:

```bash
aws sqs receive-message \
  --queue-url https://sqs.ap-southeast-2.amazonaws.com/YOUR_ACCOUNT_ID/eventbridge-dlq \
  --region ap-southeast-2
```

**Check Token Proxy logs:**

```bash
aws logs tail /aws/lambda/token-proxy --follow --region ap-southeast-2
```

---

## Common pitfalls

**`target_audience` mismatch** — The `CLOUD_RUN_URL` environment variable in the Token Proxy must exactly match the Cloud Run service URL including `https://` and with no trailing slash. A mismatch causes Cloud Run to return 401 even though the token itself is valid.

**`iamcredentials.googleapis.com` not enabled** — The Token Proxy will get a 403 from GCP with the message "API not enabled". Run the `gcloud services enable` command from step 1.1.

**Service account key not propagated** — After creating a service account, IAM bindings can take up to 60 seconds to propagate globally. If the first invocations fail with permission errors, wait and retry before debugging further.

**EventBridge connection shows `CREATING` indefinitely** — This means EventBridge tried to call your token endpoint and received an error. Check the Token Proxy Lambda logs. Common causes: wrong Function URL in the `AuthorizationEndpoint`, Lambda returning a non-200 response, or the function URL not yet active.

**`expires_in` must be accurate** — EventBridge uses the `expires_in` value from the token response to decide when to refresh. If you return 3600 but the token actually expires sooner, deliveries will fail with 401 near the end of the hour. GCP OIDC tokens are valid for exactly 3600 seconds, so 3600 is the correct value.

**S3 EventBridge notifications not enabled** — By default, S3 does not send events to EventBridge. Enable it on the bucket:

```bash
aws s3api put-bucket-notification-configuration \
  --bucket YOUR_BUCKET_NAME \
  --notification-configuration '{"EventBridgeConfiguration": {}}'
```

Without this, the EventBridge rule never fires regardless of how many files you upload.

**Lambda Function URL CORS** — EventBridge does not send CORS preflight requests, so no CORS configuration is needed on the Function URL. If you later test the endpoint from a browser, you will need to add a CORS configuration, but that is separate from the EventBridge use case.
