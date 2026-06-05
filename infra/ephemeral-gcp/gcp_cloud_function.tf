# ─────────────────────────────────────────────────────────────
# GCP Cloud Function — accept-inference (ephemeral)
#
# Deploys the accept-inference function from the shared function
# source bucket (owned by persistent workspace).  The function
# is triggered by EventBridge via API Destination (OIDC auth).
# ─────────────────────────────────────────────────────────────

# ── Zip the function source ────────────────────────────────
data "archive_file" "accept_inference_source" {
  type        = "zip"
  source_dir  = "${path.root}/../../functions/accept-inference"
  output_path = "${path.root}/build/accept-inference.zip"
}

# Upload the archive to the persistent GCS bucket
resource "google_storage_bucket_object" "accept_inference_archive" {
  name   = "accept-inference-${data.archive_file.accept_inference_source.output_md5}.zip"
  bucket = local.persistent_state.gcp_function_source_bucket
  source = data.archive_file.accept_inference_source.output_path
}

# ── Cloud Function (2nd gen) ────────────────────────────────
resource "google_cloudfunctions2_function" "accept_inference" {
  name        = "${var.app_name}-${var.environment}-accept-inference"
  description = "Accepts inference requests from EventBridge"
  location    = var.gcp_region

  build_config {
    runtime     = "python311"
    entry_point = "accept"

    source {
      storage_source {
        bucket = local.persistent_state.gcp_function_source_bucket
        object = google_storage_bucket_object.accept_inference_archive.name
      }
    }
  }

  service_config {
    available_memory   = "128Mi"
    timeout_seconds    = 30
    ingress_settings   = "ALLOW_ALL"
  }
}

# ── Restrict invocation to the EventBridge service account ──
resource "google_cloudfunctions2_function_iam_member" "accept_inference_invoker" {
  project        = google_cloudfunctions2_function.accept_inference.project
  location       = google_cloudfunctions2_function.accept_inference.location
  cloud_function = google_cloudfunctions2_function.accept_inference.name

  role   = "roles/cloudfunctions.invoker"
  member = "serviceAccount:eventbridge-invoker@${var.gcp_project_id}.iam.gserviceaccount.com"
}

# ── Output ──────────────────────────────────────────────────
output "gcp_function_url" {
  description = "HTTPS trigger URL for the accept-inference Cloud Function"
  value       = google_cloudfunctions2_function.accept_inference.url
}

output "gcp_function_name" {
  description = "Fully qualified name of the accept-inference Cloud Function"
  value       = google_cloudfunctions2_function.accept_inference.name
}
