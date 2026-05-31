resource "google_cloud_run_v2_service" "inference" {
  name     = "${var.app_name}-${var.environment}-inference"
  location = var.gcp_region

  template {
    containers {
      image = "${var.dockerhub_username}/ecolens-inference:latest"
      ports {
        container_port = 8080
      }
      env {
        name  = "MODEL_BUCKET_NAME"
        value = google_storage_bucket.models.name
      }
    }
  }

}