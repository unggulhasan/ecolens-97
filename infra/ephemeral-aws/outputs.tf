output "api_gateway_endpoint" {
  description = "HTTP API base URL (use with $default stage)"
  value       = aws_apigatewayv2_api.main.api_endpoint
}
