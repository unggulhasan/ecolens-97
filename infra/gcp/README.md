gcloud config set project ecolens-498408

gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  run.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com

gcloud iam service-accounts create eventbridge-invoker \
  --display-name="EventBridge Cloud Run Invoker" \
  --description="Used by AWS EventBridge to invoke Cloud Run via OIDC"

gcloud iam service-accounts list --filter="email:eventbridge-invoker"

gcloud iam service-accounts keys create ./sa-key.json \
  --iam-account=eventbridge-invoker@ecolens-498408.iam.gserviceaccount.com

gcloud auth activate-service-account \
  eventbridge-invoker@ecolens-498408.iam.gserviceaccount.com \
  --key-file=./sa-key.json

curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  https://australia-southeast2-ecolens-498408.cloudfunctions.net/aussie-ecolens-prod-accept-inference

---


# 1. Persistent (creates secrets)
cd infra/persistent
terraform apply -var="gcp_sa_key_json=$(cat ../gcp/sa-key.json)"

# 2. Ephemeral (everything else)
cd infra/ephemeral
terraform apply
---