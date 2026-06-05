# ─────────────────────────────────────────────────────────────
# GCP Secrets Manager — callback HMAC secret (persistent)
# Shared secret used by GCP Cloud Function to sign inference
# callbacks; validated by AWS Lambda on the return path.
# ─────────────────────────────────────────────────────────────

resource "google_secret_manager_secret" "callback_secret" {
  secret_id = "callback-secret"
  project   = var.gcp_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "callback_secret" {
  secret      = google_secret_manager_secret.callback_secret.id
  secret_data = var.callback_secret
}

# Allow the Cloud Function's default Compute Engine SA to read the secret.
# Hardcoded project number avoids depending on the compute.googleapis.com API.
resource "google_secret_manager_secret_iam_member" "callback_secret_accessor" {
  project   = var.gcp_project_id
  secret_id = google_secret_manager_secret.callback_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:572506753604-compute@developer.gserviceaccount.com"
}
