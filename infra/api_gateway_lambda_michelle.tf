resource "aws_apigatewayv2_integration" "michelle" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.michelle.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "michelle" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /michelle"
  target             = "integrations/${aws_apigatewayv2_integration.michelle.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "michelle" {
  statement_id  = "AllowAPIGatewayInvokeMichelle"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.michelle.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}