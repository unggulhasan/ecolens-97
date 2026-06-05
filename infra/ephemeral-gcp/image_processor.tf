# ─────────────────────────────────────────────────────────────
# image-processor — Cloud Run v2 service + Pub/Sub Eventarc trigger
#
# Pipeline (per gcp_image_processor_approach.md):
#   accept_inference (HTTP)
#     ├── validates X-Callback-Secret
#     └── publishes JSON to image_inference_requests topic
#                  │
#                  ▼
#   Eventarc → Cloud Run image-processor
#                  ├── downloads image via presigned_url
#                  ├── runs MegaDetector + species classifier (ONNX)
#                  └── logs the structured result JSON
#
# Why Cloud Run + Eventarc (not Cloud Functions gen2):
#   The container image is pre-built locally (see image_processor_layer.tf).
#   Cloud Functions gen2 with build_config.docker_repository expects to
#   build the image from source; Cloud Run v2 accepts a pre-built image
#   directly, which matches the AWS lambda_thumbnail container pattern.
# ─────────────────────────────────────────────────────────────

# ── Pub/Sub topic ────────────────────────────────────────────
resource "google_pubsub_topic" "image_inference_requests" {
  name = "${var.app_name}-${var.environment}-image-inference-requests"
}

# ── Runtime service account ──────────────────────────────────
resource "google_service_account" "image_processor_runtime" {
  account_id   = "${var.app_name}-${var.environment}-ip-rt"
  display_name = "EcoLens image-processor runtime SA"
}

# Read ONNX models from the persistent bucket.
resource "google_storage_bucket_iam_member" "image_processor_models_reader" {
  bucket = local.persistent_state.models_bucket_name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.image_processor_runtime.email}"
}

# Structured logging (Cloud Run grants this by default but be explicit).
resource "google_project_iam_member" "image_processor_log_writer" {
  project = var.gcp_project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.image_processor_runtime.email}"
}

# ── Cloud Run v2 service ─────────────────────────────────────
resource "google_cloud_run_v2_service" "image_processor" {
  name                = "${var.app_name}-${var.environment}-image-processor"
  location            = var.gcp_region
  deletion_protection = false
  ingress             = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account                  = google_service_account.image_processor_runtime.email
    timeout                          = "120s"
    max_instance_request_concurrency = 1

    scaling {
      min_instance_count = 0
      max_instance_count = 20
    }

    containers {
      image = local.image_processor_image_uri

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "4Gi"
        }
        startup_cpu_boost = true
      }

      env {
        name  = "MODEL_BUCKET_NAME"
        value = local.persistent_state.models_bucket_name
      }
      env {
        name  = "DETECTOR_FILE"
        value = "mdv5a.onnx"
      }
      env {
        name  = "CLASSIFIER_FILE"
        value = "model.onnx"
      }
    }
  }

  depends_on = [
    null_resource.image_processor_docker_build_push,
    google_storage_bucket_iam_member.image_processor_models_reader,
  ]
}

# ── Eventarc trigger: Pub/Sub → Cloud Run ────────────────────
#
# Trigger service account needs run.invoker on the Cloud Run service
# AND eventarc.eventReceiver on the project so Eventarc can deliver.
# google_eventarc_trigger creates a managed Pub/Sub push subscription
# under the hood when a `pubsub` transport is configured against an
# existing topic.

resource "google_service_account" "image_processor_invoker" {
  account_id   = "${var.app_name}-${var.environment}-ip-inv"
  display_name = "EcoLens image-processor Eventarc invoker"
}

resource "google_cloud_run_v2_service_iam_member" "image_processor_invoker_binding" {
  project  = var.gcp_project_id
  location = google_cloud_run_v2_service.image_processor.location
  name     = google_cloud_run_v2_service.image_processor.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.image_processor_invoker.email}"
}

resource "google_project_iam_member" "image_processor_event_receiver" {
  project = var.gcp_project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${google_service_account.image_processor_invoker.email}"
}

resource "google_eventarc_trigger" "image_processor_pubsub" {
  name            = "${var.app_name}-${var.environment}-image-processor-trigger"
  location        = var.gcp_region
  service_account = google_service_account.image_processor_invoker.email

  matching_criteria {
    attribute = "type"
    value     = "google.cloud.pubsub.topic.v1.messagePublished"
  }

  transport {
    pubsub {
      topic = google_pubsub_topic.image_inference_requests.id
    }
  }

  destination {
    cloud_run_service {
      service = google_cloud_run_v2_service.image_processor.name
      region  = google_cloud_run_v2_service.image_processor.location
    }
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.image_processor_invoker_binding,
    google_project_iam_member.image_processor_event_receiver,
  ]
}

# ── Outputs ──────────────────────────────────────────────────
output "image_processor_service_name" {
  description = "Cloud Run service name for the image-processor worker"
  value       = google_cloud_run_v2_service.image_processor.name
}

output "image_processor_topic_id" {
  description = "Pub/Sub topic ID for image inference requests"
  value       = google_pubsub_topic.image_inference_requests.id
}
