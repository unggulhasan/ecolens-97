# ─────────────────────────────────────────────────────────────
# GCP Storage Bucket — Cloud Functions source archive (persistent)
# General-purpose bucket for Cloud Functions 2nd gen deployment
# artifacts.  Shared across all GCP functions in this project.
# ─────────────────────────────────────────────────────────────

resource "google_storage_bucket" "function_source" {
  name                        = "${var.app_name}-${var.environment}-fn-source"
  location                    = var.gcp_region
  force_destroy               = true
  uniform_bucket_level_access = true

  depends_on = [google_project_service.storage]
}
