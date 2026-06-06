# ─────────────────────────────────────────────────────────────
# GCS bucket for ONNX model artefacts (persistent)
#
# Holds the MegaDetector + species classifier .onnx files
# consumed by image_processor at cold start.  Object
# versioning is enabled so model updates are rollback-safe:
# overwrite the same object name (e.g. mdv5a.onnx) and prior
# generations remain available.
#
# Updating a model (no code change, no redeploy):
#   gsutil cp new-mdv5a.onnx gs://aussie-ecolens-gcp-models/mdv5a.onnx
# ─────────────────────────────────────────────────────────────

resource "google_storage_bucket" "models" {
  name                        = "${var.app_name}-gcp-models"
  location                    = var.gcp_region
  force_destroy               = false
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  depends_on = [google_project_service.storage]
}
