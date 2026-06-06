# ─────────────────────────────────────────────────────────────
# accept-results Lambda + API Gateway route
#
# Receives inference results directly from GCP image-processor / video-processor
# Cloud Run services via API Gateway POST /inference-results.
#
# Auth: X-Callback-Secret HMAC (validated inside the Lambda).
# Route uses authorization_type = "NONE" — symmetric with GCP's
# accept-inference Cloud Function which is allUsers-invocable with
# application-level HMAC validation.
#
# Pipeline:
#   GCP image-processor / video-processor (Cloud Run)
#     └── HTTPS POST /inference-results (X-Callback-Secret)
#           └── API Gateway (this route)
#                 └── accept-results Lambda
#                       └── DynamoDB UpdateItem (tags, inference_status)
# ─────────────────────────────────────────────────────────────

data "archive_file" "lambda_accept_results" {
  type        = "zip"
  source_dir  = "${path.root}/../../functions/accept-results"
  output_path = "${path.root}/build/lambda_accept_results.zip"
}

resource "aws_lambda_function" "accept_results" {
  function_name    = "${var.app_name}-${var.environment}-accept-results"
  role             = aws_iam_role.accept_results.arn
  runtime          = "python3.11"
  handler          = "handler.handle"
  filename         = data.archive_file.lambda_accept_results.output_path
  source_code_hash = data.archive_file.lambda_accept_results.output_base64sha256
  timeout          = 15
  memory_size      = 256

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.media_files.name
      TMP_DYNAMODB_TABLE_NAME = aws_dynamodb_table.tmp_query.name
      # ARN only — the actual secret value is fetched at cold start via
      # secretsmanager:GetSecretValue so it never lands in env (plaintext in TF state).
      CALLBACK_SECRET_ARN = local.persistent_state.callback_secret_arn
      REGION_NAME         = var.aws_region
      AWS_REGION_NAME     = var.aws_region
      DYNAMODB_TABLE_NAME      = aws_dynamodb_table.media_files.name
      SNS_TOPIC_ARN            = aws_sns_topic.media_alerts.arn
      SUBSCRIPTIONS_TABLE_NAME = aws_dynamodb_table.user_subscriptions.name
      NOTIFICATIONS_TABLE_NAME = aws_dynamodb_table.user_notifications.name
    }
  }

  tags = local.common_tags
}

# ── IAM role ──────────────────────────────────────────────────
resource "aws_iam_role" "accept_results" {
  name = "${var.app_name}-${var.environment}-accept-results"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "accept_results_exec" {
  role       = aws_iam_role.accept_results.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "accept_results" {
  role = aws_iam_role.accept_results.name
  name = "${var.app_name}-${var.environment}-accept-results-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "UpdateInferenceTags"
        Effect = "Allow"
        Action = ["dynamodb:UpdateItem", "dynamodb:GetItem"]
        # GetItem is also granted so the Lambda can confirm the record exists
        # before UpdateItem (used by the ConditionalExpression path).
        Resource = aws_dynamodb_table.media_files.arn
      },
      {
        Sid      = "FetchCallbackSecret"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = local.persistent_state.callback_secret_arn
      },
      {
        Sid    = "WriteTemporaryInferenceTags"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.tmp_query.arn
      },
    ]
  })
}

# ── API Gateway integration ────────────────────────────────────
resource "aws_apigatewayv2_integration" "accept_results" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.accept_results.invoke_arn
  payload_format_version = "2.0"
}

# POST /inference-results — no JWT authorizer (auth is HMAC inside the Lambda)
resource "aws_apigatewayv2_route" "accept_results" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /inference-results"
  target             = "integrations/${aws_apigatewayv2_integration.accept_results.id}"
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "accept_results_apigw" {
  statement_id  = "AllowAPIGatewayInvokeAcceptResults"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.accept_results.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# Attach notifications/SNS policies to the accept-results role
resource "aws_iam_role_policy_attachment" "lambda_accept_results_sns" {
  role       = aws_iam_role.accept_results.name
  policy_arn = aws_iam_policy.sns_publish_policy.arn
}

resource "aws_iam_role_policy_attachment" "lambda_accept_results_notifications" {
  role       = aws_iam_role.accept_results.name
  policy_arn = aws_iam_policy.dynamodb_notifications_access.arn
}

resource "aws_iam_role_policy_attachment" "lambda_accept_results_subscriptions" {
  role       = aws_iam_role.accept_results.name
  policy_arn = aws_iam_policy.dynamodb_subscriptions_access.arn
}
