resource "google_storage_bucket" "models" {
  name                        = "${var.app_name}-gcp-models"
  location                    = var.gcp_region
  uniform_bucket_level_access = true # access control at bucket level only, not seperate for each file
  versioning {
    enabled = true # Enable versioning for model buckets to allow rollbacks and history tracking
  }
}

resource "google_storage_bucket" "processing" {
  name                       = "${var.app_name}-gcp-processing"
  location                    = var.gcp_region
  uniform_bucket_level_access = true 
  lifecycle_rule {
    action {
      type = "Delete" # Automatically delete files after a certain period to manage storage costs
    }
    condition {
      age = 1 # Delete files older than 1 day
    }
  }
}