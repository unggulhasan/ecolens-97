resource "google_cloud_run_v2_job" "video_inference" {
  name     = "${var.app_name}-${var.environment}-video-inference-job"
  location = var.gcp_region

  deletion_protection = false

  depends_on = [
    terraform_data.build_video_inference_image
  ]

  template {
    template {
      service_account = google_service_account.inference_runtime.email

      containers {
        image = local.video_inference_image
        resources {
          limits = {
            cpu    = "4"
            memory = "16Gi"
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
}