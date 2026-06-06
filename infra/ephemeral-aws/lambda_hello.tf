data "archive_file" "lambda_hello" {
  type        = "zip"
  source_dir  = "${path.root}/../../functions/health"
  output_path = "${path.root}/build/lambda_health.zip"
}

resource "aws_lambda_function" "hello" {
  function_name = "${var.app_name}-${var.environment}-health"
  role          = aws_iam_role.lambda_exec_role_hello.arn
  handler       = "handler.handle"
  runtime       = "python3.11"

  filename         = data.archive_file.lambda_hello.output_path
  source_code_hash = data.archive_file.lambda_hello.output_base64sha256

  tags = local.common_tags
}

resource "aws_iam_role" "lambda_exec_role_hello" {
  name = "${var.app_name}-${var.environment}-health"

  assume_role_policy = local.assume_role_policy_json

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_logs_hello" {
  role       = aws_iam_role.lambda_exec_role_hello.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
