locals {
  frontend_env_vars = {
    AUTH_SECRET         = var.auth_secret
    AUTH_COGNITO_ID     = aws_cognito_user_pool_client.main.id
    AUTH_COGNITO_ISSUER = local.cognito_issuer
    AUTH_COGNITO_DOMAIN = aws_cognito_user_pool_domain.main.domain
    API_BASE_URL        = aws_apigatewayv2_api.main.api_endpoint
  }
}

resource "local_file" "frontend_env" {
  content  = templatefile("${path.module}/frontend.env.tftpl", local.frontend_env_vars)
  filename = "${path.module}/../frontend/.env.local"
}

