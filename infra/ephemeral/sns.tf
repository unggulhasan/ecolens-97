# ------------------------------ SNS TOPIC --------------------------------------
resource "aws_sns_topic" "media_alerts" {
  name = "${var.app_name}-${var.environment}-media-alerts"
  tags = local.common_tags
}

# ------------------------------ SUBSCRIBE LAMBDA --------------------------------
data "archive_file" "lambda_subscribe" {
  type        = "zip"
  source_dir  = "${path.root}/../../functions/subscribe-notifications"
  output_path = "${path.root}/build/lambda_subscribe.zip"
}

resource "aws_iam_role" "lambda_exec_subscribe" {
  name               = "${var.app_name}-${var.environment}-subscribe-notifications"
  assume_role_policy = local.assume_role_policy_json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_exec_subscribe_basic" {
  role       = aws_iam_role.lambda_exec_subscribe.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# IAM Policy to allow Lambda to call sns:Subscribe
resource "aws_iam_policy" "sns_subscribe_policy" {
  name = "${var.app_name}-${var.environment}-sns-subscribe-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = [
          "sns:Subscribe",
          "sns:ListSubscriptionsByTopic",
          "sns:GetSubscriptionAttributes",
          "sns:SetSubscriptionAttributes"
        ]
        Resource = [
          aws_sns_topic.media_alerts.arn,
          "arn:aws:sns:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.app_name}-${var.environment}-media-alerts:*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_exec_subscribe_sns" {
  role       = aws_iam_role.lambda_exec_subscribe.name
  policy_arn = aws_iam_policy.sns_subscribe_policy.arn
}

resource "aws_lambda_function" "subscribe" {
  function_name    = "${var.app_name}-${var.environment}-subscribe-notifications"
  role             = aws_iam_role.lambda_exec_subscribe.arn
  handler          = "handler.handle"
  runtime          = "python3.11"
  filename         = data.archive_file.lambda_subscribe.output_path
  source_code_hash = data.archive_file.lambda_subscribe.output_base64sha256

  environment {
    variables = {
      SNS_TOPIC_ARN   = aws_sns_topic.media_alerts.arn
      AWS_REGION_NAME = var.aws_region
    }
  }

  tags = local.common_tags
}

# ------------------------------ API GATEWAY INTEGRATION -------------------------
resource "aws_apigatewayv2_integration" "subscribe" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.subscribe.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "subscribe" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /subscribe"
  target             = "integrations/${aws_apigatewayv2_integration.subscribe.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "subscribe_get" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /subscribe"
  target             = "integrations/${aws_apigatewayv2_integration.subscribe.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "subscribe" {
  statement_id  = "AllowAPIGatewayInvokeSubscribe"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.subscribe.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ------------------------------ PUBLISH PERMISSIONS -----------------------------
resource "aws_iam_policy" "sns_publish_policy" {
  name = "${var.app_name}-${var.environment}-sns-publish-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = aws_sns_topic.media_alerts.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_5_sns" {
  role       = aws_iam_role.lambda_exec_query_5.name
  policy_arn = aws_iam_policy.sns_publish_policy.arn
}
