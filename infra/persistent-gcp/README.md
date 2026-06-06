# persistent-gcp

Long-lived GCP resources that survive across ephemeral teardowns:

- `gcp_apis.tf` — required Google APIs (Cloud Functions, Run, Artifact Registry, Pub/Sub, Eventarc, Secret Manager, …)
- `gcp_artifact_registry.tf` — `ecolens-repo` Docker repository
- `gcp_models_bucket.tf` — `${app_name}-gcp-models` bucket (versioning enabled)
- `gcp_function_bucket.tf` — shared Cloud Functions source archive bucket
- `gcp_secrets.tf` — `callback-secret` (shared HMAC for AWS ↔ GCP)

## Apply

```bash
terraform -chdir=infra/persistent-gcp init
terraform -chdir=infra/persistent-gcp apply
```

## Uploading / updating ONNX models

The `image-processor` Cloud Run service downloads models from this
bucket at cold start using **fixed filenames** (`mdv5a.onnx`,
`model.onnx`). To roll out a new model version, **overwrite the object
in place** — no code change, no `terraform apply`, no function redeploy.

```bash
# Initial upload (or full replacement)
gsutil cp models/mdv5a.onnx gs://aussie-ecolens-gcp-models/mdv5a.onnx
gsutil cp models/model.onnx gs://aussie-ecolens-gcp-models/model.onnx

# Future update — same command; bucket versioning preserves the prior
# generation so you can roll back.
gsutil cp new-mdv5a.onnx    gs://aussie-ecolens-gcp-models/mdv5a.onnx
```

### Rollback

```bash
# List generations
gsutil ls -a gs://aussie-ecolens-gcp-models/mdv5a.onnx

# Restore a previous generation
gsutil cp gs://aussie-ecolens-gcp-models/mdv5a.onnx#<generation> \
          gs://aussie-ecolens-gcp-models/mdv5a.onnx
```

Warm Cloud Run instances keep the old ORT session in memory until they
scale down. Force an immediate cutover by redeploying the revision (no
code change required) or waiting for natural scale-to-zero.
