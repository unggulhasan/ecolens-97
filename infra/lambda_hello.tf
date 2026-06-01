data "archive_file" "lambda_hello" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/hello"
  output_path = "${path.module}/build/lambda_hello.zip"
}

resource "aws_lambda_function" "hello" {
  function_name = "${var.app_name}-${var.environment}-hello"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "lambda_function.handler"
  runtime       = "python3.11"

  filename         = data.archive_file.lambda_hello.output_path
  source_code_hash = data.archive_file.lambda_hello.output_base64sha256

  tags = local.common_tags
}