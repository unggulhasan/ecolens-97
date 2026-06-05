# Infrastructure

The `infra/` directory is split into four single-cloud Terraform root modules.

```
infra/
  persistent-gcp/   GCP APIs, GCS bucket, GCP Secret Manager
  persistent-aws/   S3, Cognito, ECR, AWS Secrets Manager
  ephemeral-gcp/    GCP Cloud Function (accept-inference)
  ephemeral-aws/    Lambdas, API Gateway, EventBridge, DynamoDB, CloudWatch
```

**You** own the GCP modules. **Your teammate** runs only the AWS modules and never needs GCP credentials.

---

## Prerequisites

### GCP one-time bootstrap (run once, by you)

> Skip if the `eventbridge-invoker` service account and `sa-key.json` already exist.

```bash
gcloud config set project ecolens-498408

# Enable APIs required for the service account + OIDC token flow
gcloud services enable \
  run.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com

# Create the service account EventBridge uses to invoke the Cloud Function
gcloud iam service-accounts create eventbridge-invoker \
  --display-name="EventBridge Cloud Run Invoker" \
  --description="Used by AWS EventBridge to invoke Cloud Functions via OIDC"

# Verify
gcloud iam service-accounts list --filter="email:eventbridge-invoker"

# Download the key — keep this file secret, never commit it
gcloud iam service-accounts keys create ./sa-key.json \
  --iam-account=eventbridge-invoker@ecolens-498408.iam.gserviceaccount.com

# Store the key somewhere safe outside the repo, e.g.:
mv ./sa-key.json ~/.gcp/ecolens-sa-key.json
```

### Generate the shared callback secret (run once, by you)

This value must be the same in both `persistent-gcp` and `persistent-aws`.

```bash
openssl rand -hex 32
# Save the output — you will need it in both tfvars files
```

---

## Terraform apply order

```
persistent-gcp ──┐
                 ├──► ephemeral-gcp ──┐
persistent-aws ──┘                   ├──► ephemeral-aws
                 └────────────────────┘
```

### Step 1 — persistent-gcp (you)

```bash
cd infra/persistent-gcp
terraform init
terraform apply
```

Requires `callback_secret` in `terraform.tfvars`.

### Step 2 — persistent-aws (teammate)

```bash
cd infra/persistent-aws
terraform init
terraform apply
```

Requires `media_bucket_name`, `callback_secret` (same value as step 1), and `gcp_sa_key_json` in `terraform.tfvars`:

```hcl
gcp_sa_key_json = <<EOT
{ ... contents of sa-key.json ... }
EOT
```

Or pass on the CLI to avoid putting JSON in the tfvars file:

```bash
terraform apply -var="gcp_sa_key_json=$(cat ~/.gcp/ecolens-sa-key.json)"
```

Steps 1 and 2 have no dependency on each other and can run in parallel.

### Step 3 — ephemeral-gcp (you)

```bash
cd infra/ephemeral-gcp
terraform init
terraform apply

# Note the Cloud Function URL for step 4
terraform output gcp_function_url
```

Must run after step 1 (reads `persistent-gcp` state).

### Step 4 — ephemeral-aws (teammate)

Set `gcp_function_url` in `terraform.tfvars` to the output from step 3, then:

```bash
cd infra/ephemeral-aws
terraform init
terraform apply
```

Must run after steps 2 and 3.

---

## Values to hand to your teammate

After steps 1–3 are complete, give your teammate:

| Variable | How to get it |
|---|---|
| `gcp_sa_key_json` | Contents of `~/.gcp/ecolens-sa-key.json` |
| `callback_secret` | The value you generated in prerequisites |
| `gcp_function_url` | `terraform output gcp_function_url` from `ephemeral-gcp` |

---

## Verify Cloud Function auth (optional)

```bash
gcloud auth activate-service-account \
  eventbridge-invoker@ecolens-498408.iam.gserviceaccount.com \
  --key-file=~/.gcp/ecolens-sa-key.json

curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  $(cd infra/ephemeral-gcp && terraform output -raw gcp_function_url)
```

---

## Troubleshooting

**IAM roles already exist (EntityAlreadyExists 409)** — leftover from a previous apply with different state. Import them into the new state:

```bash
cd infra/ephemeral-aws
terraform import aws_iam_role.<resource_name> <role-name>
# e.g.
terraform import aws_iam_role.lambda_exec_role_hello aussie-ecolens-prod-health
```

**Secrets Manager secret scheduled for deletion (InvalidRequestException 400)** — force-delete the old secret first:

```bash
aws secretsmanager delete-secret \
  --secret-id "prod/gcp/sa-key" \
  --force-delete-without-recovery \
  --region ap-southeast-4
```

Then re-run `terraform apply`.

**EventBridge API Destination URL invalid** — `gcp_function_url` is still set to the placeholder. Update `ephemeral-aws/terraform.tfvars` with the real URL from step 3.
