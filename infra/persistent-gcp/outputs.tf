output "gcp_function_source_bucket" {
  description = "GCS bucket name for Cloud Functions source archives"
  value       = google_storage_bucket.function_source.name
}
