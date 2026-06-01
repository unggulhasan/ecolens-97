data "archive_file" "lambda_michelle" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/michelle"
  output_path = "${path.module}/build/lambda_michelle.zip"
}

resource "aws_lambda_function" "michelle" {
  function_name = "${var.app_name}-${var.environment}-michelle"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "lambda_function.handler"
  runtime       = "python3.11"

  filename         = data.archive_file.lambda_michelle.output_path
  source_code_hash = data.archive_file.lambda_michelle.output_base64sha256

  tags = local.common_tags
}