locals {
  image_inference_image = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.inference_repo.repository_id}/ecolens-inference:${var.image_tag}"

  video_inference_image = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.inference_repo.repository_id}/ecolens-video-inference:${var.image_tag}"
}

resource "terraform_data" "build_image_inference_image" {
  triggers_replace = {
    image_tag = var.image_tag

    source_hash = sha256(join("", [
      for file in fileset("${path.module}/../functions/gcp_inference", "**") :
      filesha256("${path.module}/../functions/gcp_inference/${file}")
    ]))
  }

  provisioner "local-exec" {
    command = <<EOT
gcloud builds submit ${path.module}/../functions/gcp_inference \
  --project=${var.gcp_project_id} \
  --tag=${local.image_inference_image}
EOT
  }

  depends_on = [
    google_artifact_registry_repository.inference_repo,
    google_project_iam_member.cloud_build_artifact_registry_writer
  ]
}

resource "terraform_data" "build_video_inference_image" {
  triggers_replace = {
    image_tag = var.image_tag

    source_hash = sha256(join("", [
      for file in fileset("${path.module}/../functions/gcp_video_inference", "**") :
      filesha256("${path.module}/../functions/gcp_video_inference/${file}")
    ]))
  }

  provisioner "local-exec" {
    command = <<EOT
gcloud builds submit ${path.module}/../functions/gcp_video_inference \
  --project=${var.gcp_project_id} \
  --tag=${local.video_inference_image}
EOT
  }

  depends_on = [
    google_artifact_registry_repository.inference_repo,
    google_project_iam_member.cloud_build_artifact_registry_writer
  ]
}