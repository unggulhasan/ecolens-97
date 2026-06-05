# ─────────────────────────────────────────────────────────────
# Secrets Manager — GCP OIDC secrets (persistent)
# ─────────────────────────────────────────────────────────────

# Auto-generated client secret for EventBridge OAuth connection
resource "random_password" "eventbridge_client_secret" {
  length  = 64
  special = false
}

# GCP service account key — passed as a Terraform variable at apply time
resource "aws_secretsmanager_secret" "gcp_sa_key" {
  name        = "prod/gcp/sa-key"
  description = "GCP service account key for EventBridge OIDC token generation"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "gcp_sa_key" {
  secret_id     = aws_secretsmanager_secret.gcp_sa_key.id
  secret_string = var.gcp_sa_key_json
}

# EventBridge client secret — the credential EventBridge presents to Token Proxy
resource "aws_secretsmanager_secret" "eventbridge_client_secret" {
  name        = "prod/eventbridge/client-secret"
  description = "Client secret that EventBridge presents to the Token Proxy Lambda"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "eventbridge_client_secret" {
  secret_id     = aws_secretsmanager_secret.eventbridge_client_secret.id
  secret_string = random_password.eventbridge_client_secret.result
}
