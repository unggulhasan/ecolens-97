resource "google_cloud_run_v2_service" "inference" {
  name                = "${var.app_name}-${var.environment}-inference"
  location            = var.gcp_region
  deletion_protection = false

  template {

    service_account                  = google_service_account.inference_runtime.email
    max_instance_request_concurrency = 1

    scaling {
      min_instance_count = 1
      max_instance_count = 3
    }

    containers {
      image = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/ecolens-repo/ecolens-inference:latest"
      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "2"
          memory = "4Gi"
        }
      }

      env {
        name  = "MODEL_BUCKET_NAME"
        value = google_storage_bucket.storage.name
      }

      env {
        name  = "MODEL_PREFIX"
        value = "models"
      }

      env {
        name  = "MEGADETECTOR_MODEL_FILE"
        value = "mdv5a.pt"
      }

      env {
        name  = "SPECIES_MODEL_FILE"
        value = "model.pt"
      }

      env {
        name  = "LABELS_FILE"
        value = "labels.txt"
      }

    }
  }

}

resource "google_cloud_run_v2_service" "orchestrator" {
  name     = "${var.app_name}-${var.environment}-orchestrator"
  location = var.gcp_region

  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.orchestrator_runtime.email

    containers {
      image = "australia-southeast1-docker.pkg.dev/${var.gcp_project_id}/ecolens-repo/ecolens-orchestrator:latest"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    max_instance_request_concurrency = 10
  }
}