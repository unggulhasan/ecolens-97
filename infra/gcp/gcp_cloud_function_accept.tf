# ─────────────────────────────────────────────────────────────
# Cloud Function: accept
# Simple HTTP function returning {"message": "accepted"}
# ─────────────────────────────────────────────────────────────

# ── Enable required APIs ───────────────────────────────────
resource "google_project_service" "cloudfunctions" {
  project            = var.gcp_project_id
  service            = "cloudfunctions.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloudbuild" {
  project            = var.gcp_project_id
  service            = "cloudbuild.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "storage" {
  project            = var.gcp_project_id
  service            = "storage.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "secretmanager" {
  project            = var.gcp_project_id
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}
# ── Zip the function source code ───────────────────────────
data "archive_file" "accept_function_source" {
  type        = "zip"
  source_dir  = "${path.module}/accept_function"
  output_path = "${path.module}/accept_function.zip"
}

# Bucket to store the function source archive
resource "google_storage_bucket_object" "accept_function_archive" {
  name   = "accept-function-${data.archive_file.accept_function_source.output_md5}.zip"
  bucket = google_storage_bucket.accept_function_bucket.name
  source = data.archive_file.accept_function_source.output_path
}

resource "google_storage_bucket" "accept_function_bucket" {
  name                        = "${var.app_name}-${var.environment}-accept-fn"
  location                    = var.gcp_region
  force_destroy               = true
  uniform_bucket_level_access = true

  depends_on = [google_project_service.storage]
}

# Cloud Function (2nd gen — required for australia-southeast2 / Melbourne)
resource "google_cloudfunctions2_function" "accept" {
  name        = "${var.app_name}-${var.environment}-accept"
  description = "Simple accept function returning JSON"
  location    = var.gcp_region

  build_config {
    runtime     = "python311"
    entry_point = "accept"

    source {
      storage_source {
        bucket = google_storage_bucket.accept_function_bucket.name
        object = google_storage_bucket_object.accept_function_archive.name
      }
    }
  }

  service_config {
    available_memory   = "128Mi"
    timeout_seconds    = 30
    ingress_settings   = "ALLOW_ALL"
  }

  depends_on = [google_project_service.cloudfunctions, google_project_service.cloudbuild]
}

# Restrict invocation to the EventBridge service account only
resource "google_cloudfunctions2_function_iam_member" "accept_invoker" {
  project        = google_cloudfunctions2_function.accept.project
  location       = google_cloudfunctions2_function.accept.location
  cloud_function = google_cloudfunctions2_function.accept.name

  role   = "roles/cloudfunctions.invoker"
  member = "serviceAccount:eventbridge-invoker@ecolens-498408.iam.gserviceaccount.com"
}

# ── Callback HMAC Secret ───────────────────────────────────
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

# Allow the Cloud Function's runtime SA to read the secret
data "google_compute_default_service_account" "default" {
  project = var.gcp_project_id
}

resource "google_secret_manager_secret_iam_member" "callback_secret_accessor" {
  project   = var.gcp_project_id
  secret_id = google_secret_manager_secret.callback_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${data.google_compute_default_service_account.default.email}"
}
