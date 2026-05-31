resource "google_storage_bucket" "models" {
  name                        = "${var.app_name}-gcp-models"
  location                    = var.gcp_region
  uniform_bucket_level_access = true # access control at bucket level only, not seperate for each file
  versioning {
    enabled = true # Enable versioning for model buckets to allow rollbacks and history tracking
  }
}