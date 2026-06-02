resource "google_service_account" "inference_runtime" {
  account_id   = "${var.app_name}-${var.environment}-inference-runtime"
  display_name = "EcoLens Inference Runtime Service Account"
}

resource "google_storage_bucket_iam_member" "inference_model_bucket_reader" {
  bucket = google_storage_bucket.models.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.inference_runtime.email}"
}