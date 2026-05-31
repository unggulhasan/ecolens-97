output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.main.id
}

output "cognito_domain" {
  description = "Cognito hosted UI domain"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "api_gateway_endpoint" {
  description = "HTTP API base URL (use with $default stage)"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "api_hello_url" {
  description = "Full URL for the GET /hello route"
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/hello"
}

output "cognito_issuer" {
  description = "Cognito JWT issuer URL (use as AUTH_COGNITO_ISSUER in frontend)"
  value       = local.cognito_issuer
}
