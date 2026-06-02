resource "aws_ecr_repository" "thumbnail" {
  name         = "thumbnail"
  force_delete = true

  tags = local.common_tags
}

resource "aws_ecr_repository_policy" "thumbnail" {
  repository = aws_ecr_repository.thumbnail.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "LambdaECRImageRetrievalPolicy"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
          "ecr:GetRepositoryPolicy"
        ]
        Condition = {
          StringLike = {
            "aws:sourceArn" = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:*"
          }
        }
      }
    ]
  })
}

locals {
  ecr_docker_registry = data.terraform_remote_state.persistent.outputs.ecr_docker_registry
  thumbnail_image_uri = "${aws_ecr_repository.thumbnail.repository_url}:latest"
  base_image_uri      = data.terraform_remote_state.persistent.outputs.base_image_uri
}

resource "null_resource" "thumbnail_docker_build_push" {
  triggers = {
    lambda_function = filesha256("${path.root}/../../functions/thumbnail/lambda_function.py")
    dockerfile      = filesha256("${path.root}/../../functions/thumbnail/Dockerfile")
  }

  provisioner "local-exec" {
    command = <<-EOT
      aws ecr get-login-password --region ${var.aws_region} | \
        docker login --username AWS --password-stdin ${local.ecr_docker_registry}

      docker buildx build \
        --platform linux/amd64 \
        --provenance=false \
        --push \
        --build-arg BASE_IMAGE_URI=${local.base_image_uri} \
        -t ${local.thumbnail_image_uri} \
        ${path.root}/../../functions/thumbnail
    EOT
  }

  depends_on = [aws_ecr_repository.thumbnail]
}
