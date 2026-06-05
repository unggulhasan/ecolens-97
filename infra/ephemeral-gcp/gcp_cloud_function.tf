# ─────────────────────────────────────────────────────────────
# GCP Cloud Function — accept-inference (ephemeral)
#
# Deploys the accept-inference function from the shared function
# source bucket (owned by persistent workspace).  The function
# is triggered by EventBridge via API Destination (API Key auth
# with shared callback_secret, validated at application level).
# ─────────────────────────────────────────────────────────────

data "google_cloud_run_v2_service" "accept_inference_backing" {
  name     = google_cloudfunctions2_function.accept_inference.name
  location = google_cloudfunctions2_function.accept_inference.location
}

resource "google_cloud_run_v2_service_iam_member" "accept_invoker_all_users_run" {
  name     = data.google_cloud_run_v2_service.accept_inference_backing.name
  location = data.google_cloud_run_v2_service.accept_inference_backing.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

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
  description = "Accepts inference requests from EventBridge (API Key auth)"
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

    secret_environment_variables {
      key        = "CALLBACK_SECRET"
      project_id = var.gcp_project_id
      secret     = "callback-secret"
      version    = "latest"
    }
  }
}

# Allow unauthenticated invocation (auth is handled at application level via X-Callback-Secret HMAC)
resource "google_cloudfunctions2_function_iam_member" "accept_invoker_all_users" {
  project        = google_cloudfunctions2_function.accept_inference.project
  location       = google_cloudfunctions2_function.accept_inference.location
  cloud_function = google_cloudfunctions2_function.accept_inference.name
  role           = "roles/cloudfunctions.invoker"
  member         = "allUsers"
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
