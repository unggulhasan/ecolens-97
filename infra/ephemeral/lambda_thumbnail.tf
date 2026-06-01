data "archive_file" "lambda_thumbnail" {
  type        = "zip"
  source_dir  = "${path.root}/../../functions/thumbnail"
  output_path = "${path.root}/build/lambda_thumbnail.zip"
}

resource "aws_lambda_function" "thumbnail" {
  function_name = "${var.app_name}-${var.environment}-thumbnail"
  role          = aws_iam_role.thumbnail_exec.arn
  handler       = "lambda_function.handler"
  runtime       = "python3.11"
  timeout       = 30
  memory_size   = 1024

  filename         = data.archive_file.lambda_thumbnail.output_path
  source_code_hash = data.archive_file.lambda_thumbnail.output_base64sha256

  environment {
    variables = {
      MEDIA_BUCKET_NAME = data.terraform_remote_state.persistent.outputs.media_bucket_name
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
