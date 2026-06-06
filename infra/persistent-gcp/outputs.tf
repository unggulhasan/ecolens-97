output "gcp_function_source_bucket" {
  description = "GCS bucket name for Cloud Functions source archives"
  value       = google_storage_bucket.function_source.name
}

output "artifact_registry_repository_id" {
  description = "Fully-qualified Artifact Registry repository ID (used by Cloud Functions docker_repository)"
  value       = google_artifact_registry_repository.inference_repo.id
}

output "artifact_registry_docker_url" {
  description = "Docker registry URL prefix for the inference repo (e.g. region-docker.pkg.dev/project/ecolens-repo)"
  value       = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.inference_repo.repository_id}"
}

output "models_bucket_name" {
  description = "GCS bucket holding ONNX model artefacts"
  value       = google_storage_bucket.models.name
}
