# Infrastructure

The `infra/` directory is split into five Terraform root modules.

```
infra/
  tf-init/          Bootstrap: S3 state bucket + DynamoDB lock table (run once)
  persistent-gcp/   GCP APIs, GCS bucket, GCP Secret Manager
  persistent-aws/   S3, Cognito, ECR, AWS Secrets Manager
  ephemeral-gcp/    GCP Cloud Function (accept-inference)
  ephemeral-aws/    Lambdas, API Gateway, EventBridge, DynamoDB, CloudWatch
```

The **GCP owner** manages the GCP modules. The **AWS owner** runs the AWS modules and never needs GCP credentials.

---

## Prerequisites

### Configure AWS credentials (each team member, one-time)

All team members need AWS credentials configured locally before running any `terraform` command.

**1. Obtain your Access Key from the AWS Console**

> IAM → Users → your user → **Security credentials** tab → **Create access key**

Copy the **Access Key ID** and **Secret Access Key** (the secret is shown only once).

**2. Configure the AWS CLI**

```bash
aws configure
```

Enter the values when prompted:

```
AWS Access Key ID [None]:     AKIA...
AWS Secret Access Key [None]: <your-secret-key>
Default region name [None]:   ap-southeast-4
Default output format [None]: json
```

This writes credentials to `~/.aws/credentials` under the `[default]` profile.
Terraform picks them up automatically — no extra config needed.

> **Named profile (optional):** If you already have a `[default]` profile for other AWS work,
> use `aws configure --profile ecolens` instead, then set `export AWS_PROFILE=ecolens`
> in your shell (or add it to `~/.zshrc`) before running Terraform.

**3. Verify access**

```bash
aws sts get-caller-identity
# Should return your account ID and IAM user ARN
```

---

### Generate the shared callback secret (run once, by the GCP owner)

This value must be the same in both `persistent-gcp` and `persistent-aws`.
It is used for cross-cloud auth in both directions (AWS ↔ GCP).

```bash
openssl rand -hex 32
# Save the output — it is required in both tfvars files
```

---

## Terraform apply order

```
tf-init ──────────────────────────────────────────────────────────────────► (S3 + DynamoDB)
                                                                                    │
persistent-gcp ──┐                                                                  │ (shared state backend)
                 ├──► ephemeral-gcp ──┐                                             │
persistent-aws ──┘                   ├──► ephemeral-aws ─────┐                     ◄┘
                 └────────────────────┘                       │                      │
                                     ◄────────────────────────┘ (aws_results_url)   │
```

`ephemeral-gcp` and `ephemeral-aws` have a cross-reference: `ephemeral-aws` needs the
GCP function URL, and `ephemeral-gcp` needs the AWS inference results URL. The
`deploy.sh` script handles this automatically.

---

### Automated deploy (recommended)

The `deploy.sh` script orchestrates the full pipeline. It applies in order,
extracts outputs, and injects cross-module values via `TF_VAR_*` environment variables.

```bash
# GCP owner (all GCP modules + tf-init)
cd infra
cp tf-init/terraform.tfvars.example tf-init/terraform.tfvars
cp persistent-gcp/terraform.tfvars.example persistent-gcp/terraform.tfvars \
  # edit callback_secret with: openssl rand -hex 32
cp ephemeral-gcp/terraform.tfvars.example ephemeral-gcp/terraform.tfvars

./deploy.sh --skip-aws --auto-approve

# AWS owner (persistent-aws + ephemeral-aws)
cd infra
cp persistent-aws/terraform.tfvars.example persistent-aws/terraform.tfvars \
  # edit callback_secret (same value as persistent-gcp)
cp ephemeral-aws/terraform.tfvars.example ephemeral-aws/terraform.tfvars

./deploy.sh --skip-gcp --auto-approve
```

For a fresh full deploy with both clouds:

```bash
cd infra
./deploy.sh --auto-approve
```

| Flag | Effect |
|---|---|
| `--skip-persistent` | Skip persistent-gcp and persistent-aws |
| `--skip-gcp` | Skip all GCP modules |
| `--skip-aws` | Skip all AWS modules |
| `--auto-approve` | Pass `-auto-approve` to `terraform apply` |

**What the script does under the hood:**

1. Applies `persistent-gcp` and `persistent-aws` (no cross-dependency, can run in parallel)
2. Applies `ephemeral-gcp`, extracts `gcp_function_url`
3. Applies `ephemeral-aws` with `TF_VAR_gcp_function_url` injected
4. Re-applies `ephemeral-gcp` with `TF_VAR_aws_results_url` (from step 3 output)

The re-apply in step 4 is only needed on **first deploy** — on subsequent applies
the AWS results URL is already known (stored in state), so it's a no-op if nothing changed.

---

### Manual deploy (if you prefer step-by-step)

### Step 0 — tf-init (one-time bootstrap)

Creates the shared S3 bucket and DynamoDB lock table used as the remote backend by all other modules.
Run this **once** before any other module. Never needs to be run again unless the bucket/table is deleted.

```bash
cd infra/tf-init
cp terraform.tfvars.example terraform.tfvars   # edit if app_name or region differs
terraform init
terraform apply
```

#### Migrate existing local state to S3 (one-time, per module)

After `tf-init` has been applied, each module owner migrates their local state to S3 by
re-initialising with the new S3 backend. Terraform will prompt to copy the existing state.

**GCP owner:**

```bash
cd infra/persistent-gcp && terraform init -migrate-state   # enter "yes" when prompted
cd infra/ephemeral-gcp  && terraform init -migrate-state   # enter "yes" when prompted
```

**AWS owner:**

```bash
cd infra/persistent-aws && terraform init -migrate-state   # enter "yes" when prompted
cd infra/ephemeral-aws  && terraform init -migrate-state   # enter "yes" when prompted
```

Verify all four state files landed in S3:

```bash
aws s3 ls s3://aussie-ecolens-tfstate/ --recursive
```

From this point on, `terraform init` for any new team member or CI runner automatically
pulls state from S3 — no local state files required.

---

### Step 1 — persistent-gcp (GCP owner)

```bash
cd infra/persistent-gcp
cp terraform.tfvars.example terraform.tfvars \
  # edit callback_secret with: openssl rand -hex 32
terraform init
terraform apply
```

### Step 2 — persistent-aws (AWS owner)

```bash
cd infra/persistent-aws
cp terraform.tfvars.example terraform.tfvars \
  # edit callback_secret (same value as step 1)
terraform init
terraform apply
```

Steps 1 and 2 have no dependency on each other and can run in parallel.

### Step 3 — ephemeral-gcp (GCP owner)

```bash
cd infra/ephemeral-gcp
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply

# Capture the URL for step 4
GCP_FN_URL=$(terraform output -raw gcp_function_url)
```

Must run after step 1 (reads `persistent-gcp` state).

### Step 4 — ephemeral-aws (AWS owner)

```bash
cd infra/ephemeral-aws
cp terraform.tfvars.example terraform.tfvars \
  # edit gcp_function_url with value from step 3
# OR inject it at apply time:
TF_VAR_gcp_function_url="$GCP_FN_URL" terraform init
TF_VAR_gcp_function_url="$GCP_FN_URL" terraform apply
```

Must run after steps 2 and 3.

### Step 5 — re-apply ephemeral-gcp (GCP owner)

After step 4 completes, feed the AWS URL back into `ephemeral-gcp`:

```bash
cd infra/ephemeral-aws
AWS_URL=$(terraform output -raw inference_results_url)

cd ../ephemeral-gcp
TF_VAR_aws_results_url="[\"$AWS_URL\"]" terraform apply
```

This step is required on first deploy so the GCP image/video processors know where
to POST inference results. Subsequent applies can skip this — the URL doesn't change
unless the API Gateway is recreated.

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
