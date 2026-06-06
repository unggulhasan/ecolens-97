data "google_project" "current" {
  project_id = var.gcp_project_id
}

locals {
  cloud_build_service_account = "${data.google_project.current.number}@cloudbuild.gserviceaccount.com"
}

resource "google_project_iam_member" "cloud_build_artifact_registry_writer" {
  project = var.gcp_project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${local.cloud_build_service_account}"

  depends_on = [
    google_project_service.required_apis
  ]
}