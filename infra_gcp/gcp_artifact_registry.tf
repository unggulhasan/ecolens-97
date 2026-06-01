resource "google_artifact_registry_repository" "inference_repo" {
  location      = var.gcp_region
  repository_id = "ecolens-repo"
  description   = "Docker repository for ECOLENS inference image"
  format        = "DOCKER"
}