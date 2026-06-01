locals {
  app_ecr_repository_url = data.terraform_remote_state.persistent.outputs.app_ecr_repository_url
  thumbnail_image_uri    = "${local.app_ecr_repository_url}:latest"
  thumbnail_registry     = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

resource "null_resource" "thumbnail_docker_build_push" {
  triggers = {
    lambda_function = filesha256("${path.root}/../../functions/thumbnail/lambda_function.py")
    requirements    = filesha256("${path.root}/../../functions/thumbnail/requirements.txt")
    dockerfile      = filesha256("${path.root}/../../functions/thumbnail/Dockerfile")
  }

  provisioner "local-exec" {
    command = <<-EOT
      aws ecr get-login-password --region ${var.aws_region} | \
        docker login --username AWS --password-stdin ${local.thumbnail_registry}

      docker buildx build \
        --platform linux/amd64 \
        --provenance=false \
        --push \
        -t ${local.thumbnail_image_uri} \
        ${path.root}/../../functions/thumbnail
    EOT
  }

}
