data "aws_caller_identity" "current" {}

locals {
    docker_registry = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

resource "random_id" "opencv_suffix" {
  byte_length = 4
}

resource "aws_ecr_repository" "registry" {
  name         = "base-opencv-numpy-${random_id.opencv_suffix.hex}"
  force_delete = true

  tags = local.common_tags
}

resource "aws_ecr_repository_policy" "registry" {
  repository = aws_ecr_repository.registry.name

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

resource "null_resource" "lambda_base_image_docker_build_push" {
  triggers = {
    dockerfile = filesha256("${path.root}/../../functions/base_image/Dockerfile")
  }

  provisioner "local-exec" {
    command = <<-EOT
      aws ecr get-login-password --region ${var.aws_region} | \
        docker login --username AWS --password-stdin ${local.docker_registry}

      docker buildx build \
        --platform linux/amd64 \
        --provenance=false \
        --push \
        -t ${aws_ecr_repository.registry.repository_url}:latest \
        ${path.root}/../../functions/base_image
    EOT
  }
}