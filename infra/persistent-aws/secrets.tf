# ─────────────────────────────────────────────────────────────
# Secrets Manager — shared secrets (persistent)
# ─────────────────────────────────────────────────────────────

# Callback secret — shared with GCP for HMAC authentication on both directions
resource "aws_secretsmanager_secret" "callback_secret" {
  name        = "prod/gcp/callback-secret"
  description = "Shared secret for HMAC validation of cross-cloud requests (AWS ↔ GCP)"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "callback_secret" {
  secret_id     = aws_secretsmanager_secret.callback_secret.id
  secret_string = var.callback_secret
}
