# ─────────────────────────────────────────────────────────────
# image-processor container image — local docker build + push
#
# Mirrors the AWS lambda_thumbnail_layer.tf pattern: a null_resource
# triggered by source-file hashes runs `docker buildx build --push`
# against Artifact Registry on the developer's workstation.  The
# Cloud Run service in image_processor.tf depends on this resource
# so a Terraform apply rebuilds and redeploys atomically.
#
# Prerequisites on the workstation:
#   - docker (with buildx)
#   - gcloud CLI authenticated (`gcloud auth login` + `gcloud auth configure-docker`)
# ─────────────────────────────────────────────────────────────

locals {
  artifact_registry_docker_url = local.persistent_state.artifact_registry_docker_url
  image_processor_image_uri    = "${local.artifact_registry_docker_url}/image-processor:latest"

  image_processor_src_dir = "${path.root}/../../functions/image-processor"
}

resource "null_resource" "image_processor_docker_build_push" {
  triggers = {
    dockerfile        = filesha256("${local.image_processor_src_dir}/Dockerfile")
    requirements      = filesha256("${local.image_processor_src_dir}/requirements.txt")
    main              = filesha256("${local.image_processor_src_dir}/main.py")
    inference_service = filesha256("${local.image_processor_src_dir}/inference_service.py")
    model_loader      = filesha256("${local.image_processor_src_dir}/model_loader.py")
    labels            = filesha256("${local.image_processor_src_dir}/labels.py")
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -euo pipefail

      gcloud auth configure-docker ${var.gcp_region}-docker.pkg.dev --quiet

      docker buildx build \
        --platform linux/amd64 \
        --provenance=false \
        --push \
        -t ${local.image_processor_image_uri} \
        ${local.image_processor_src_dir}
    EOT
  }
}
