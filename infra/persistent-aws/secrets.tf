# ─────────────────────────────────────────────────────────────
# Secrets Manager — shared secrets (persistent)
# ─────────────────────────────────────────────────────────────
resource "random_id" "secret_suffix" {
  byte_length = 4
}

# Callback secret — shared with GCP for HMAC authentication on both directions
resource "aws_secretsmanager_secret" "callback_secret" {
  name        = "gcp-callback-secret-${random_id.secret_suffix.hex}"
  description = "Shared secret for HMAC validation of cross-cloud requests (AWS ↔ GCP)"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "callback_secret" {
  secret_id     = aws_secretsmanager_secret.callback_secret.id
  secret_string = var.callback_secret
}
