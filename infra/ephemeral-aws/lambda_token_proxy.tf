# ─────────────────────────────────────────────────────────────
# Token Proxy Lambda (OAuth endpoint for EventBridge → GCP)
# ─────────────────────────────────────────────────────────────

# The token-proxy function needs google-auth and its transitive deps.
# We use a null_resource to pip-install into a build directory, then
# archive_file to produce the zip that Lambda consumes.
#
# Before applying, ensure python3 and pip are available on the machine
# running Terraform.

locals {
  token_proxy_src = "${path.module}/../../functions/token-proxy"
  token_proxy_build = "${path.module}/../../functions/token-proxy/build"
  token_proxy_package = "${local.token_proxy_build}/package"
}

# pip install dependencies into the build package directory
resource "null_resource" "token_proxy_deps" {
  triggers = {
    requirements = filebase64sha256("${local.token_proxy_src}/requirements.txt")
    handler      = filebase64sha256("${local.token_proxy_src}/handler.py")
  }

  provisioner "local-exec" {
    command = <<-EOT
      rm -rf '${local.token_proxy_package}'
      mkdir -p '${local.token_proxy_package}'
      pip3 install \
        --platform manylinux2014_x86_64 \
        --target '${local.token_proxy_package}' \
        --python-version 3.11 \
        --only-binary=:all: \
        --upgrade \
        -r '${local.token_proxy_src}/requirements.txt' 2>/dev/null || \
      pip3 install \
        --target '${local.token_proxy_package}' \
        --python-version 3.11 \
        --upgrade \
        -r '${local.token_proxy_src}/requirements.txt'
    EOT
  }
}

# Also copy the handler into the package directory
resource "null_resource" "token_proxy_handler" {
  triggers = {
    handler = filebase64sha256("${local.token_proxy_src}/handler.py")
  }

  provisioner "local-exec" {
    command = "cp '${local.token_proxy_src}/handler.py' '${local.token_proxy_package}/'"
  }

  depends_on = [null_resource.token_proxy_deps]
}

data "archive_file" "lambda_token_proxy" {
  type        = "zip"
  source_dir  = local.token_proxy_package
  output_path = "${local.token_proxy_build}/token-proxy.zip"

  depends_on = [null_resource.token_proxy_handler]
}

# ── Lambda ──────────────────────────────────────────────────
resource "aws_lambda_function" "token_proxy" {
  function_name    = "${var.app_name}-${var.environment}-token-proxy"
  role             = aws_iam_role.token_proxy.arn
  runtime          = "python3.11"
  handler          = "handler.handler"
  filename         = data.archive_file.lambda_token_proxy.output_path
  source_code_hash = data.archive_file.lambda_token_proxy.output_base64sha256
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      GCP_FUNCTION_URL    = var.gcp_function_url
      SA_KEY_SECRET       = "prod/gcp/sa-key"
      CLIENT_ID           = "eventbridge-client"
      CLIENT_SECRET_NAME  = "prod/eventbridge/client-secret"
    }
  }

  tags = local.common_tags
}

# API Gateway route — Token Proxy does its own OAuth validation
# Using API Gateway instead of Function URL to avoid needing
# lambda:CreateFunctionUrlConfig on the caller's IAM principal.
resource "aws_apigatewayv2_integration" "token_proxy" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.token_proxy.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "token_proxy" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /auth/token"
  target             = "integrations/${aws_apigatewayv2_integration.token_proxy.id}"
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "token_proxy_apigw" {
  statement_id  = "AllowInvokeFromApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.token_proxy.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*"
}

# ── IAM ─────────────────────────────────────────────────────
resource "aws_iam_role" "token_proxy" {
  name = "${var.app_name}-${var.environment}-token-proxy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "token_proxy_exec" {
  role       = aws_iam_role.token_proxy.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "token_proxy_secrets" {
  role = aws_iam_role.token_proxy.name
  name = "${var.app_name}-${var.environment}-token-proxy-secrets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [
          local.persistent_state.gcp_sa_key_secret_arn,
          local.persistent_state.eb_client_secret_arn,
        ]
      }
    ]
  })
}

# ── Output ──────────────────────────────────────────────────
output "token_proxy_url" {
  description = "Token Proxy URL (used by EventBridge Connection as authorization_endpoint)"
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/auth/token"
}
