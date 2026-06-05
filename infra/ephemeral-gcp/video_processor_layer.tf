# ─────────────────────────────────────────────────────────────
# video-processor container image — local docker build + push
#
# Mirrors image_processor_layer.tf: a null_resource triggered by
# source-file hashes runs `docker buildx build --push` against
# Artifact Registry on the developer's workstation.
# ─────────────────────────────────────────────────────────────

locals {
  video_processor_image_uri = "${local.artifact_registry_docker_url}/video-processor:latest"
  video_processor_src_dir   = "${path.root}/../../functions/video-processor"
}

resource "null_resource" "video_processor_docker_build_push" {
  triggers = {
    dockerfile        = filesha256("${local.video_processor_src_dir}/Dockerfile")
    requirements      = filesha256("${local.video_processor_src_dir}/requirements.txt")
    main              = filesha256("${local.video_processor_src_dir}/main.py")
    inference_service = filesha256("${local.video_processor_src_dir}/inference_service.py")
    frame_extractor   = filesha256("${local.video_processor_src_dir}/frame_extractor.py")
    aggregator        = filesha256("${local.video_processor_src_dir}/aggregator.py")
    model_loader      = filesha256("${local.video_processor_src_dir}/model_loader.py")
    labels            = filesha256("${local.video_processor_src_dir}/labels.py")
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -euo pipefail

      gcloud auth configure-docker ${var.gcp_region}-docker.pkg.dev --quiet

      docker buildx build \
        --platform linux/amd64 \
        --provenance=false \
        --push \
        -t ${local.video_processor_image_uri} \
        ${local.video_processor_src_dir}
    EOT
  }
}
