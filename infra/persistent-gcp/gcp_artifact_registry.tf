# ─────────────────────────────────────────────────────────────
# Artifact Registry — Docker repository for inference images
# (persistent)
#
# Holds the container images for image_processor (ONNX
# inference Cloud Run service) and any future ML workers.
# ─────────────────────────────────────────────────────────────

resource "google_artifact_registry_repository" "inference_repo" {
  location      = var.gcp_region
  repository_id = "ecolens-repo"
  format        = "DOCKER"
  description   = "Docker repository for EcoLens GCP inference containers"

  depends_on = [google_project_service.artifactregistry]
}
