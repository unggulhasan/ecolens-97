resource "google_storage_bucket" "models" {

  name                        = "${var.app_name}-gcp-models"
  location                    = var.gcp_region
  uniform_bucket_level_access = true

  # Enable versioning for model buckets to allow rollbacks and history tracking
  versioning {
    enabled = true
  }

}