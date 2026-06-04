resource "google_storage_bucket" "storage" {
  name                        = "${var.app_name}-gcp-storage"
  location                    = var.gcp_region
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      age            = 1
      matches_prefix = ["processing/"]
    }
  }
}