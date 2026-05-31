data "archive_file" "lambda_presign" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/presign"
  output_path = "${path.module}/build/lambda_presign.zip"
}

resource "aws_lambda_function" "presign" {
  function_name = "${var.app_name}-${var.environment}-presign"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "lambda_function.handler"
  runtime       = "python3.11"

  filename         = data.archive_file.lambda_presign.output_path
  source_code_hash = data.archive_file.lambda_presign.output_base64sha256

  environment {
    variables = {
      MEDIA_BUCKET_NAME = var.media_bucket_name
      REGION_NAME = var.aws_region
    }
  }

  tags = local.common_tags
}

data "aws_iam_policy_document" "presign_s3" {
  statement {
    effect = "Allow"
    actions = [
      "s3:PutObject",
    ]
    resources = ["${aws_s3_bucket.s3_media.arn}/*"]
  }
}

resource "aws_iam_policy" "presign_s3" {
  name   = "${var.app_name}-${var.environment}-presign-s3"
  policy = data.aws_iam_policy_document.presign_s3.json

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "presign_s3" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.presign_s3.arn
}
