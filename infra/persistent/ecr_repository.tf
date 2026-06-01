data "aws_caller_identity" "current" {}

resource "aws_ecr_repository" "registry" {
  name         = "base-opencv-numpy"
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