locals {
  common_tags = {
    App         = var.app_name
    Environment = var.environment
  }

  assume_role_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  presign_s3_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject"]
      Resource = "${data.terraform_remote_state.persistent.outputs.media_bucket_arn}/*"
    }]
  })

  api_lambda_functions = {
    hello   = aws_lambda_function.hello
    presign = aws_lambda_function.presign
  }

  frontend_env_vars = {
    AUTH_SECRET         = var.auth_secret
    AUTH_COGNITO_ID     = data.terraform_remote_state.persistent.outputs.cognito_client_id
    AUTH_COGNITO_ISSUER = data.terraform_remote_state.persistent.outputs.cognito_issuer
    AUTH_COGNITO_DOMAIN = data.terraform_remote_state.persistent.outputs.cognito_domain
    API_BASE_URL        = aws_apigatewayv2_api.main.api_endpoint
  }
}
