# Aussie EcoLens

Wildlife detection platform that lets users upload images and videos, runs ONNX-based species inference on GCP, and stores the tagged results back on AWS.

---

## Architecture overview

```
Browser (Next.js)
  │
  │  Upload (presigned URL)
  ▼
AWS S3  ──► EventBridge ──► Resolver Lambda
                                  │
                           ecolens.gcp.inference
                                  │
                                  ▼
                        EventBridge API Destination
                        (X-Callback-Secret header)
                                  │
                                  ▼
                     GCP Cloud Function  accept-inference
                          ├── image  ──► Pub/Sub topic
                          │              └── Eventarc ──► Cloud Run  image-processor
                          │                                    ├── ONNX inference
                          │                                    └── POST /inference-results ──┐
                          └── video  ──► Pub/Sub topic                                       │
                                         └── Eventarc ──► Cloud Run  video-processor         │
                                                              ├── FFmpeg frame extract        │
                                                              ├── ONNX inference              │
                                                              └── POST /inference-results ────┤
                                                                                              │
                                                                          (X-Callback-Secret) │
                                                                                              ▼
                                                                     AWS API Gateway  POST /inference-results
                                                                          └── Lambda  accept-results
                                                                                └── DynamoDB  UpdateItem
                                                                                    (tags, inference_status)
```

### Cross-cloud auth
Both directions (AWS → GCP and GCP → AWS) use the same **shared `callback_secret`** value transmitted in the `X-Callback-Secret` HTTP header and validated with `hmac.compare_digest`.

---

## Repository layout

```
frontend/              Next.js app (shadcn/ui, NextAuth, Cognito)
functions/
  accept-inference/    GCP Cloud Function — receives inference requests from AWS EventBridge
  accept-results/      AWS Lambda — receives inference results from GCP processors → DynamoDB
  create-presign-url/  AWS Lambda — generates S3 presigned upload URLs
  delete-media/        AWS Lambda — deletes a media file and its DynamoDB record
  detect-image-tags/   AWS Lambda — manual tag detection trigger
  health/              AWS Lambda — health-check endpoint
  image-processor/     GCP Cloud Run — ONNX inference on images (MegaDetector + classifier)
  list-all-files/      AWS Lambda — lists all media files for a user
  lookup-by-thumbnail/ AWS Lambda — fetches a media record by thumbnail key
  on-media-uploaded/   AWS Lambda — triggered by S3 Object Created (images/ & videos/)
  on-thumbnail-created/AWS Lambda — triggered when a thumbnail lands in thumbnails/
  on-tmp-uploaded/     AWS Lambda — triggered by S3 Object Created (tmp/)
  resolve-and-forward/ AWS Lambda — resolves file metadata and emits GcpInferenceRequest
  search-by-species/   AWS Lambda — searches DynamoDB by species tag
  search-by-tags/      AWS Lambda — searches DynamoDB by arbitrary tags
  token-proxy/         AWS Lambda — proxies Cognito token exchange
  update-file-tags/    AWS Lambda — manually updates tags on a DynamoDB record
  video-processor/     GCP Cloud Run — ONNX inference on videos (frame extract + classify)
infra/
  persistent-gcp/      GCP APIs, GCS buckets, Secret Manager (apply once)
  persistent-aws/      S3, Cognito, ECR, AWS Secrets Manager (apply once)
  ephemeral-gcp/       Cloud Run services, accept-inference Cloud Function, Eventarc triggers
  ephemeral-aws/       API Gateway, Lambdas, EventBridge rules, DynamoDB, CloudWatch
models/                ONNX model files (mdv5a.onnx detector, model.onnx classifier)
model-converter/       Scripts to convert models to ONNX format
```

---

## Prerequisites

- Terraform ≥ 1.5
- AWS CLI configured for `ap-southeast-4`
- `gcloud` CLI authenticated with the target GCP project
- Docker (for building Cloud Run images)

### Generate the shared callback secret *(run once)*

This value must be identical in both `persistent-gcp` and `persistent-aws`.

```bash
openssl rand -hex 32
# Save the output — you need it in both tfvars files
```

---

## Terraform apply order

```
persistent-gcp ──┐
                 ├──► ephemeral-gcp ──┐
persistent-aws ──┘                   ├──► ephemeral-aws
                 └────────────────────┘
```

### Step 1 — `persistent-gcp` *(you)*

```bash
cd infra/persistent-gcp
terraform init && terraform apply
```

Requires `callback_secret` in `terraform.tfvars`.

### Step 2 — `persistent-aws` *(teammate)*

```bash
cd infra/persistent-aws
terraform init && terraform apply
```

Requires `media_bucket_name` and `callback_secret` (same value as step 1) in `terraform.tfvars`.

Steps 1 and 2 are independent and can run in parallel.

### Step 3 — `ephemeral-gcp` *(you)*

```bash
cd infra/ephemeral-gcp
terraform init && terraform apply

# Copy this URL for step 4
terraform output gcp_function_url
```

Also copy the `inference_results_url` output from `ephemeral-aws` (step 4) into `terraform.tfvars` as `aws_results_url` before applying — the two Cloud Run services need it to POST results back.

### Step 4 — `ephemeral-aws` *(teammate)*

Set `gcp_function_url` in `terraform.tfvars` to the output from step 3, then:

```bash
cd infra/ephemeral-aws
terraform init && terraform apply

# Hand this back to you for step 3
terraform output inference_results_url
```

> **Cross-dependency:** `ephemeral-gcp` needs `aws_results_url` from `ephemeral-aws`, and `ephemeral-aws` needs `gcp_function_url` from `ephemeral-gcp`. Apply `ephemeral-aws` first with a placeholder URL, grab its output, then apply `ephemeral-gcp` with the real URL, and finally re-apply `ephemeral-aws` to confirm parity.

---

## Values to exchange with your teammate

| Variable | Direction | How to get it |
|---|---|---|
| `callback_secret` | you → teammate | Generated in prerequisites |
| `gcp_function_url` | you → teammate | `terraform output gcp_function_url` from `ephemeral-gcp` |
| `aws_results_url` | teammate → you | `terraform output inference_results_url` from `ephemeral-aws` |

---

## Frontend

```bash
cd frontend
cp .env.local.example .env.local   # or let Terraform generate it
npm install
npm run dev
```

See `frontend/README.md` for component and environment variable details.

---

## Troubleshooting

**IAM roles already exist (EntityAlreadyExists 409)** — import them:

```bash
cd infra/ephemeral-aws
terraform import aws_iam_role.<name> <role-name>
```

**Secrets Manager secret scheduled for deletion (InvalidRequestException 400)**:

```bash
aws secretsmanager delete-secret \
  --secret-id "prod/gcp/sa-key" \
  --force-delete-without-recovery \
  --region ap-southeast-4
```

**EventBridge API Destination URL invalid** — `gcp_function_url` is still a placeholder. Update `ephemeral-aws/terraform.tfvars` with the real URL from step 3.

**Inference result not written to DynamoDB** — check the Cloud Run logs:

```bash
gcloud run services logs read aussie-ecolens-prod-image-processor --region australia-southeast2
gcloud run services logs read aussie-ecolens-prod-video-processor  --region australia-southeast2
```

Look for `[PROCESS] Posted result to AWS … status=200`. A `401` means the `callback_secret` is mismatched; a `404` means the `file_id` row doesn't exist in DynamoDB yet.

