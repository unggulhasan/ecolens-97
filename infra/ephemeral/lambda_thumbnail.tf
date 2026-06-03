resource "aws_lambda_function" "thumbnail" {
  function_name    = "${var.app_name}-${var.environment}-thumbnail"
  role             = aws_iam_role.thumbnail_exec.arn
  package_type     = "Image"
  image_uri        = local.thumbnail_image_uri
  timeout          = 30
  memory_size      = 1024
  source_code_hash = sha256(join(",", [
    filesha256("${path.root}/../../functions/thumbnail/lambda_function.py")
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
  name = "${var.app_name}-${var.environment}-thumbnail"

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
