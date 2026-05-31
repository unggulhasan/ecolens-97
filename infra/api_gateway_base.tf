resource "aws_apigatewayv2_api" "main" {
  name          = "${var.app_name}-${var.environment}"
  protocol_type = "HTTP"

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${var.app_name}-${var.environment}"
  retention_in_days = 30

  tags = local.common_tags
}

data "aws_iam_policy_document" "api_log" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }

    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = ["${aws_cloudwatch_log_group.api.arn}:*"]
  }
}

resource "aws_cloudwatch_log_resource_policy" "api" {
  policy_name     = "${var.app_name}-${var.environment}-apigw"
  policy_document = data.aws_iam_policy_document.api_log.json
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.app_name}-cognito-authorizer"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.main.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn

    # JSON format capturing key request/response context
    format = jsonencode({
      requestId        = "$context.requestId"
      sourceIp         = "$context.identity.sourceIp"
      httpMethod       = "$context.httpMethod"
      routeKey         = "$context.routeKey"
      path             = "$context.path"
      status           = "$context.status"
      responseLength   = "$context.responseLength"
      integrationError = "$context.integrationErrorMessage"
      latency          = "$context.responseLatency"
      userAgent        = "$context.identity.userAgent"
    })
  }

  tags = local.common_tags
}

locals {
  api_lambda_functions = {
    hello   = aws_lambda_function.hello
    presign = aws_lambda_function.presign
  }
}

resource "aws_lambda_permission" "api" {
  for_each = local.api_lambda_functions

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = each.value.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
