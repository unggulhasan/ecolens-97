resource "google_service_account" "inference_runtime" {
  account_id   = "${var.app_name}-${var.environment}-inf-rt"
  display_name = "EcoLens Inference Runtime Service Account"
}

resource "google_storage_bucket_iam_member" "inference_model_bucket_reader" {
  bucket = google_storage_bucket.models.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.inference_runtime.email}"
}

resource "google_storage_bucket_iam_member" "inference_processing_bucket_reader" {
  bucket = google_storage_bucket.processing.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.inference_runtime.email}"
}

resource "google_service_account" "orchestrator_runtime" {
  account_id   = "${var.app_name}-${var.environment}-orch-rt"
  display_name = "EcoLens Orchestrator Runtime Service Account"
}

resource "google_service_account" "aws_orchestrator_invoker" {
  account_id   = "${var.app_name}-aws-och-invkr"
  display_name = "AWS Orchestrator Invoker"
}

resource "google_cloud_run_v2_service_iam_member" "aws_can_invoke_orchestrator" {
  project  = var.gcp_project_id
  location = var.gcp_region
  name     = google_cloud_run_v2_service.orchestrator.name

  role   = "roles/run.invoker"
  member = "serviceAccount:${google_service_account.aws_orchestrator_invoker.email}"
}