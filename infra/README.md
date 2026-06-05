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

### Generate the shared callback secret (run once, by you)

This value must be the same in both `persistent-gcp` and `persistent-aws`.
It is used for cross-cloud auth in both directions (AWS ↔ GCP).

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

Requires `media_bucket_name` and `callback_secret` (same value as step 1) in `terraform.tfvars`:

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
| `callback_secret` | The value you generated in prerequisites |
| `gcp_function_url` | `terraform output gcp_function_url` from `ephemeral-gcp` |

---

## Verify Cloud Function auth (optional)

```bash
# Without the secret — should return 401
curl -i $(cd infra/ephemeral-gcp && terraform output -raw gcp_function_url)

# With the correct callback_secret — should return 200
curl -i \
  -H "X-Callback-Secret: $(cd infra/persistent-gcp && terraform output -raw callback_secret 2>/dev/null || echo '<your-callback-secret>')" \
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
