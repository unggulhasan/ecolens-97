resource "aws_apigatewayv2_integration" "presign" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.presign.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "presign" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /presign"
  target             = "integrations/${aws_apigatewayv2_integration.presign.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}
