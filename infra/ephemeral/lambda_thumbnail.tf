resource "aws_lambda_function" "thumbnail" {
  function_name    = "${var.app_name}-${var.environment}-on-image-uploaded"
  role             = aws_iam_role.thumbnail_exec.arn
  package_type     = "Image"
  image_uri        = local.thumbnail_image_uri
  timeout          = 30
  memory_size      = 1024
  source_code_hash = sha256(join(",", [
    filesha256("${path.root}/../../functions/on-image-uploaded/handler.py")
  ]))

  depends_on = [null_resource.thumbnail_docker_build_push]

  environment {
    variables = {
      MEDIA_BUCKET_NAME = local.persistent_state.media_bucket_name
      REGION_NAME       = var.aws_region
    }
  }

  tags = local.common_tags
}

resource "aws_iam_role" "thumbnail_exec" {
  name = "${var.app_name}-${var.environment}-on-image-uploaded"

  assume_role_policy = local.assume_role_policy_json

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "thumbnail_exec_attachment" {
  role       = aws_iam_role.thumbnail_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "thumbnail_ecr_attachment" {
  role       = aws_iam_role.thumbnail_exec.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy" "thumbnail_s3" {
  name = "${var.app_name}-${var.environment}-on-image-uploaded-s3"
  role = aws_iam_role.thumbnail_exec.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ListBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = "arn:aws:s3:::${local.persistent_state.media_bucket_name}"
      },
      {
        Sid    = "ReadSourceImages"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:GetObjectAttributes", "s3:HeadObject"]
        Resource = "arn:aws:s3:::${local.persistent_state.media_bucket_name}/images/*"
      },
      {
        Sid      = "ReadWriteThumbnails"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:HeadObject", "s3:PutObject"]
        Resource = "arn:aws:s3:::${local.persistent_state.media_bucket_name}/thumbnails/*"
      }
    ]
  })
}
