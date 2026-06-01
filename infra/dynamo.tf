
# ------------------------------ TABLE ------------------------------------------
resource "aws_dynamodb_table" "media_files" {
  name         = "${var.app_name}-${var.environment}-media"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "file_url"

  attribute {
    name = "file_url"
    type = "S"
  }

  tags = local.common_tags
}

# ------------------------------ IAM PERMISSIONS ---------------------------------
resource "aws_iam_policy" "dynamodb_access" {
  name = "${var.app_name}-${var.environment}-dynamodb-access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan",
        "dynamodb:Query"
      ]
      Resource = aws_dynamodb_table.media_files.arn
    }]
  })
}

resource "aws_iam_role_policy_attachment" "dynamodb_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}


# ------------------------------ QUERY TEST LAMBDA ------------------------------
data "archive_file" "lambda_query_test" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/query_test"
  output_path = "${path.module}/build/lambda_query_test.zip"
}

resource "aws_lambda_function" "query_test" {
  function_name = "${var.app_name}-${var.environment}-query-test"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "lambda_function.handler"
  runtime       = "python3.11"

  filename         = data.archive_file.lambda_query_test.output_path
  source_code_hash = data.archive_file.lambda_query_test.output_base64sha256

  tags = local.common_tags
}


# ------------------------------ QUERY 1 ---------------------------------------
data "archive_file" "lambda_query_1" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/query_1"
  output_path = "${path.module}/build/lambda_query_1.zip"
}

resource "aws_lambda_function" "query_1" {
  function_name = "${var.app_name}-${var.environment}-query-1"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "lambda_function.handler"
  runtime       = "python3.11"

  filename         = data.archive_file.lambda_query_1.output_path
  source_code_hash = data.archive_file.lambda_query_1.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.media_files.name
      AWS_REGION_NAME     = var.aws_region
    }
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "query_1" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.query_1.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "query_1" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /query-1"
  target             = "integrations/${aws_apigatewayv2_integration.query_1.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "query_1" {
  statement_id  = "AllowAPIGatewayInvokeQuery1"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.query_1.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}                 


# ------------------------------ QUERY 2 ---------------------------------------
data "archive_file" "lambda_query_2" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/query_2"
  output_path = "${path.module}/build/lambda_query_2.zip"
}

resource "aws_lambda_function" "query_2" {
  function_name = "${var.app_name}-${var.environment}-query-2"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "lambda_function.handler"
  runtime       = "python3.11"

  filename         = data.archive_file.lambda_query_2.output_path
  source_code_hash = data.archive_file.lambda_query_2.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.media_files.name
      AWS_REGION_NAME     = var.aws_region
    }
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "query_2" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.query_2.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "query_2" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /query-2"
  target             = "integrations/${aws_apigatewayv2_integration.query_2.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "query_2" {
  statement_id  = "AllowAPIGatewayInvokeQuery2"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.query_2.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}


# ------------------------------ QUERY 3 ---------------------------------------
data "archive_file" "lambda_query_3" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/query_3"
  output_path = "${path.module}/build/lambda_query_3.zip"
}

resource "aws_lambda_function" "query_3" {
  function_name = "${var.app_name}-${var.environment}-query-3"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "lambda_function.handler"
  runtime       = "python3.11"

  filename         = data.archive_file.lambda_query_3.output_path
  source_code_hash = data.archive_file.lambda_query_3.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.media_files.name
      AWS_REGION_NAME     = var.aws_region
    }
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "query_3" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.query_3.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "query_3" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /query-3"
  target             = "integrations/${aws_apigatewayv2_integration.query_3.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "query_3" {
  statement_id  = "AllowAPIGatewayInvokeQuery3"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.query_3.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ------------------------------ QUERY 4 ---------------------------------------
data "archive_file" "lambda_query_4" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/query_4"
  output_path = "${path.module}/build/lambda_query_4.zip"
}

resource "aws_lambda_function" "query_4" {
  function_name = "${var.app_name}-${var.environment}-query-4"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "lambda_function.handler"
  runtime       = "python3.11"

  filename         = data.archive_file.lambda_query_4.output_path
  source_code_hash = data.archive_file.lambda_query_4.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.media_files.name
      AWS_REGION_NAME     = var.aws_region
    }
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "query_4" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.query_4.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "query_4" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /query-4"
  target             = "integrations/${aws_apigatewayv2_integration.query_4.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "query_4" {
  statement_id  = "AllowAPIGatewayInvokeQuery4"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.query_4.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ------------------------------ QUERY 5 ---------------------------------------
data "archive_file" "lambda_query_5" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/query_5"
  output_path = "${path.module}/build/lambda_query_5.zip"
}

resource "aws_lambda_function" "query_5" {
  function_name = "${var.app_name}-${var.environment}-query-5"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "lambda_function.handler"
  runtime       = "python3.11"

  filename         = data.archive_file.lambda_query_5.output_path
  source_code_hash = data.archive_file.lambda_query_5.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.media_files.name
      AWS_REGION_NAME     = var.aws_region
    }
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "query_5" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.query_5.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "query_5" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /query-5"
  target             = "integrations/${aws_apigatewayv2_integration.query_5.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "query_5" {
  statement_id  = "AllowAPIGatewayInvokeQuery5"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.query_5.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}


# ------------------------------ QUERY 6 ---------------------------------------
data "archive_file" "lambda_query_6" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/query_6"
  output_path = "${path.module}/build/lambda_query_6.zip"
}

resource "aws_lambda_function" "query_6" {
  function_name = "${var.app_name}-${var.environment}-query-6"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "lambda_function.handler"
  runtime       = "python3.11"

  filename         = data.archive_file.lambda_query_6.output_path
  source_code_hash = data.archive_file.lambda_query_6.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.media_files.name
      AWS_REGION_NAME     = var.aws_region
    }
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "query_6" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.query_6.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "query_6" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /query-6"
  target             = "integrations/${aws_apigatewayv2_integration.query_6.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "query_6" {
  statement_id  = "AllowAPIGatewayInvokeQuery6"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.query_6.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}



