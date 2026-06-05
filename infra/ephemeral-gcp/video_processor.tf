# ─────────────────────────────────────────────────────────────
# video-processor — Cloud Run v2 service + Pub/Sub Eventarc trigger
#
# Pipeline (per gcp_video_processor_approach.md):
#   accept_inference (HTTP)
#     ├── validates X-Callback-Secret
#     └── publishes JSON to video_inference_requests topic
#                  │
#                  ▼
#   Eventarc → Cloud Run video-processor
#                  ├── downloads video via presigned_url
#                  ├── extracts frames at 1fps via FFmpeg
#                  ├── runs ONNX inference per frame (2 threads)
#                  ├── aggregates species counts (max per species)
#                  └── logs the structured result JSON
#
# Deployment: Cloud Run v2 (not CF gen2 as in approach doc) — pre-built
# container pattern matches image_processor.tf for consistency.
# ─────────────────────────────────────────────────────────────

# ── Pub/Sub topic ────────────────────────────────────────────
resource "google_pubsub_topic" "video_inference_requests" {
  name = "${var.app_name}-${var.environment}-video-inference-requests"
}

# ── Runtime service account ──────────────────────────────────
resource "google_service_account" "video_processor_runtime" {
  account_id   = "${var.app_name}-${var.environment}-vp-rt"
  display_name = "EcoLens video-processor runtime SA"
}

# Read ONNX models from the persistent bucket.
resource "google_storage_bucket_iam_member" "video_processor_models_reader" {
  bucket = local.persistent_state.models_bucket_name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.video_processor_runtime.email}"
}

# Structured logging.
resource "google_project_iam_member" "video_processor_log_writer" {
  project = var.gcp_project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.video_processor_runtime.email}"
}

# ── Cloud Run v2 service ─────────────────────────────────────
resource "google_cloud_run_v2_service" "video_processor" {
  name                = "${var.app_name}-${var.environment}-video-processor"
  location            = var.gcp_region
  deletion_protection = false
  ingress             = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account                  = google_service_account.video_processor_runtime.email
    timeout                          = "3600s" # 60-min max; tune to expected clip length
    max_instance_request_concurrency = 1       # one video per instance

    scaling {
      min_instance_count = 1  # keep one warm instance to avoid cold-start redelivery storms
      max_instance_count = 10 # lower than image-processor; each job is heavier
    }

    containers {
      image = local.video_processor_image_uri

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "2"   # supports 2 parallel inference workers
          memory = "8Gi" # /tmp RAM-backed; models + frames need headroom
        }
        cpu_idle          = true # throttle CPU between requests — ~8x cheaper than always-allocated
        startup_cpu_boost = true # full CPU during cold-start model load
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
      env {
        name  = "FRAME_FPS"
        value = "1"
      }
      env {
        name  = "MAX_FRAMES"
        value = "600"
      }
    }
  }

  depends_on = [
    null_resource.video_processor_docker_build_push,
    google_storage_bucket_iam_member.video_processor_models_reader,
  ]
}

# ── Eventarc trigger: Pub/Sub → Cloud Run ────────────────────
resource "google_service_account" "video_processor_invoker" {
  account_id   = "${var.app_name}-${var.environment}-vp-inv"
  display_name = "EcoLens video-processor Eventarc invoker"
}

resource "google_cloud_run_v2_service_iam_member" "video_processor_invoker_binding" {
  project  = var.gcp_project_id
  location = google_cloud_run_v2_service.video_processor.location
  name     = google_cloud_run_v2_service.video_processor.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.video_processor_invoker.email}"
}

resource "google_project_iam_member" "video_processor_event_receiver" {
  project = var.gcp_project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${google_service_account.video_processor_invoker.email}"
}

resource "google_eventarc_trigger" "video_processor_pubsub" {
  name            = "${var.app_name}-${var.environment}-video-processor-trigger"
  location        = var.gcp_region
  service_account = google_service_account.video_processor_invoker.email

  matching_criteria {
    attribute = "type"
    value     = "google.cloud.pubsub.topic.v1.messagePublished"
  }

  transport {
    pubsub {
      topic = google_pubsub_topic.video_inference_requests.id
    }
  }

  destination {
    cloud_run_service {
      service = google_cloud_run_v2_service.video_processor.name
      region  = google_cloud_run_v2_service.video_processor.location
    }
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.video_processor_invoker_binding,
    google_project_iam_member.video_processor_event_receiver,
  ]
}

# ── Patch Eventarc subscription ack deadline ─────────────────
# Eventarc auto-creates a Pub/Sub push subscription with the default
# ack deadline of 10 s.  Processing a video (download + FFmpeg +
# inference) easily exceeds 10 s even on a warm instance, so Pub/Sub
# re-delivers the message to a new instance before the first one
# can respond — causing duplicate runs.  We patch it to 600 s (the
# maximum) after the trigger is created.
resource "null_resource" "video_processor_extend_ack_deadline" {
  triggers = {
    trigger_name = google_eventarc_trigger.video_processor_pubsub.name
    topic_name   = google_pubsub_topic.video_inference_requests.name
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -euo pipefail
      SUB=$(gcloud pubsub subscriptions list \
        --filter="topic:projects/${var.gcp_project_id}/topics/${google_pubsub_topic.video_inference_requests.name}" \
        --format="value(name)" --limit=1)
      echo "Patching ack deadline on: $SUB"
      gcloud pubsub subscriptions update "$SUB" \
        --ack-deadline=600 \
        --min-retry-delay=60s \
        --max-retry-delay=600s
    EOT
  }

  depends_on = [google_eventarc_trigger.video_processor_pubsub]
}

# ── Outputs ──────────────────────────────────────────────────
output "video_processor_service_name" {
  description = "Cloud Run service name for the video-processor worker"
  value       = google_cloud_run_v2_service.video_processor.name
}

output "video_processor_topic_id" {
  description = "Pub/Sub topic ID for video inference requests"
  value       = google_pubsub_topic.video_inference_requests.id
}
