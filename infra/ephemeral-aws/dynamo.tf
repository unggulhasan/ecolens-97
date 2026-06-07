# ------------------------------ TABLE ------------------------------------------
resource "aws_dynamodb_table" "media_files" {
  name           = "${var.app_name}-${var.environment}-media"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "file_id"

  attribute {
    name = "file_id"
    type = "S"
  }

  attribute {
    name = "checksum"
    type = "S"
  }

  global_secondary_index {
    name            = "checksum-gsi"
    hash_key        = "checksum"
    projection_type = "KEYS_ONLY"
  }

  tags = local.common_tags
}

# ------------------------------ IAM PERMISSIONS --------------------------------
resource "aws_iam_policy" "dynamodb_access" {
  name = "${var.app_name}-${var.environment}-dynamodb-access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
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
      },
      {
        # Query access on checksum GSI — for presign Lambda dedup check
        Effect   = "Allow"
        Action   = ["dynamodb:Query"]
        Resource = "${aws_dynamodb_table.media_files.arn}/index/checksum-gsi"
      }
    ]
  })
}

# S3 delete permissions — attached to Q6 only (least privilege)
resource "aws_iam_policy" "s3_delete_access" {
  name = "${var.app_name}-${var.environment}-s3-delete-access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:DeleteObject"]
      Resource = "${local.persistent_state.media_bucket_arn}/*"
    }]
  })
}

# ------------------------------ QUERY TEST LAMBDA ------------------------------
data "archive_file" "lambda_query_test" {
  type        = "zip"
  source_dir  = "${path.root}/../../functions/query-test"
  output_path = "${path.root}/build/lambda_query_test.zip"
}

resource "aws_iam_role" "lambda_exec_query_test" {
  name               = "${var.app_name}-${var.environment}-query-test"
  assume_role_policy = local.assume_role_policy_json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_test_basic" {
  role       = aws_iam_role.lambda_exec_query_test.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "query_test" {
  function_name    = "${var.app_name}-${var.environment}-query-test"
  role             = aws_iam_role.lambda_exec_query_test.arn
  handler          = "handler.handle"
  runtime          = "python3.11"
  filename         = data.archive_file.lambda_query_test.output_path
  source_code_hash = data.archive_file.lambda_query_test.output_base64sha256
  tags             = local.common_tags
}


# ------------------------------ QUERY 1 — tags count --------------------------
data "archive_file" "lambda_query_1" {
  type        = "zip"
  source_dir  = "${path.root}/../../functions/search-by-tags"
  output_path = "${path.root}/build/lambda_query_1.zip"
}

resource "aws_iam_role" "lambda_exec_query_1" {
  name               = "${var.app_name}-${var.environment}-search-by-tags"
  assume_role_policy = local.assume_role_policy_json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_1_basic" {
  role       = aws_iam_role.lambda_exec_query_1.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_1_dynamodb" {
  role       = aws_iam_role.lambda_exec_query_1.name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_1_s3" {
  role       = aws_iam_role.lambda_exec_query_1.name
  policy_arn = aws_iam_policy.s3_get_object_access.arn
}

resource "aws_lambda_function" "query_1" {
  function_name    = "${var.app_name}-${var.environment}-search-by-tags"
  role             = aws_iam_role.lambda_exec_query_1.arn
  handler          = "handler.handle"
  runtime          = "python3.11"
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
  route_key          = "POST /search-by-tags"
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


# ------------------------------ QUERY 2 — species -----------------------------
data "archive_file" "lambda_query_2" {
  type        = "zip"
  source_dir  = "${path.root}/../../functions/search-by-species"
  output_path = "${path.root}/build/lambda_query_2.zip"
}

resource "aws_iam_role" "lambda_exec_query_2" {
  name               = "${var.app_name}-${var.environment}-search-by-species"
  assume_role_policy = local.assume_role_policy_json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_2_basic" {
  role       = aws_iam_role.lambda_exec_query_2.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_2_dynamodb" {
  role       = aws_iam_role.lambda_exec_query_2.name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_2_s3" {
  role       = aws_iam_role.lambda_exec_query_2.name
  policy_arn = aws_iam_policy.s3_get_object_access.arn
}

resource "aws_lambda_function" "query_2" {
  function_name    = "${var.app_name}-${var.environment}-search-by-species"
  role             = aws_iam_role.lambda_exec_query_2.arn
  handler          = "handler.handle"
  runtime          = "python3.11"
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
  route_key          = "POST /search-by-species"
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


# ------------------------------ QUERY 3 — thumbnail ---------------------------
data "archive_file" "lambda_query_3" {
  type        = "zip"
  source_dir  = "${path.root}/../../functions/lookup-by-thumbnail"
  output_path = "${path.root}/build/lambda_query_3.zip"
}

resource "aws_iam_role" "lambda_exec_query_3" {
  name               = "${var.app_name}-${var.environment}-lookup-by-thumbnail"
  assume_role_policy = local.assume_role_policy_json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_3_basic" {
  role       = aws_iam_role.lambda_exec_query_3.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_3_dynamodb" {
  role       = aws_iam_role.lambda_exec_query_3.name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_3_s3" {
  role       = aws_iam_role.lambda_exec_query_3.name
  policy_arn = aws_iam_policy.s3_get_object_access.arn
}

resource "aws_lambda_function" "query_3" {
  function_name    = "${var.app_name}-${var.environment}-lookup-by-thumbnail"
  role             = aws_iam_role.lambda_exec_query_3.arn
  handler          = "handler.handle"
  runtime          = "python3.11"
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
  route_key          = "POST /lookup-by-thumbnail"
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


# ------------------------------ QUERY 4 — file tags ---------------------------
data "archive_file" "lambda_query_4" {
  type        = "zip"
  source_dir  = "${path.root}/../../functions/detect-image-tags"
  output_path = "${path.root}/build/lambda_query_4.zip"
}

resource "aws_iam_role" "lambda_exec_query_4" {
  name               = "${var.app_name}-${var.environment}-detect-image-tags"
  assume_role_policy = local.assume_role_policy_json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_4_basic" {
  role       = aws_iam_role.lambda_exec_query_4.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_4_dynamodb" {
  role       = aws_iam_role.lambda_exec_query_4.name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_4_s3" {
  role       = aws_iam_role.lambda_exec_query_4.name
  policy_arn = aws_iam_policy.s3_get_object_access.arn
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_4_s3_delete" {
  role       = aws_iam_role.lambda_exec_query_4.name
  policy_arn = aws_iam_policy.s3_delete_access.arn
}

resource "aws_iam_policy" "tmp_query_read" {
  name = "${var.app_name}-${var.environment}-tmp-query-read"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:DeleteItem"]
      Resource = aws_dynamodb_table.tmp_query.arn
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_4_tmp" {
  role       = aws_iam_role.lambda_exec_query_4.name
  policy_arn = aws_iam_policy.tmp_query_read.arn
}

resource "aws_lambda_function" "query_4" {
  function_name    = "${var.app_name}-${var.environment}-detect-image-tags"
  role             = aws_iam_role.lambda_exec_query_4.arn
  handler          = "handler.handle"
  runtime          = "python3.11"
  filename         = data.archive_file.lambda_query_4.output_path
  source_code_hash = data.archive_file.lambda_query_4.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.media_files.name
      AWS_REGION_NAME     = var.aws_region
      GCP_ML_ENDPOINT     = var.gcp_ml_endpoint
      TMP_TABLE_NAME      = aws_dynamodb_table.tmp_query.name
      MEDIA_BUCKET_NAME   = local.persistent_state.media_bucket_name
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
  route_key          = "POST /detect-image-tags"
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


# ------------------------------ QUERY 5 — tags update -------------------------
data "archive_file" "lambda_query_5" {
  type        = "zip"
  source_dir  = "${path.root}/../../functions/update-file-tags"
  output_path = "${path.root}/build/lambda_query_5.zip"
}

resource "aws_iam_role" "lambda_exec_query_5" {
  name               = "${var.app_name}-${var.environment}-update-file-tags"
  assume_role_policy = local.assume_role_policy_json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_5_basic" {
  role       = aws_iam_role.lambda_exec_query_5.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_5_dynamodb" {
  role       = aws_iam_role.lambda_exec_query_5.name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

resource "aws_lambda_function" "query_5" {
  function_name    = "${var.app_name}-${var.environment}-update-file-tags"
  role             = aws_iam_role.lambda_exec_query_5.arn
  handler          = "handler.handle"
  runtime          = "python3.11"
  filename         = data.archive_file.lambda_query_5.output_path
  source_code_hash = data.archive_file.lambda_query_5.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE_NAME      = aws_dynamodb_table.media_files.name
      SUBSCRIPTIONS_TABLE_NAME = aws_dynamodb_table.user_subscriptions.name
      NOTIFICATIONS_TABLE_NAME = aws_dynamodb_table.user_notifications.name
      AWS_REGION_NAME          = var.aws_region
      SNS_TOPIC_ARN            = aws_sns_topic.media_alerts.arn
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
  route_key          = "POST /update-file-tags"
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


# ------------------------------ QUERY 6 — delete ------------------------------
data "archive_file" "lambda_query_6" {
  type        = "zip"
  source_dir  = "${path.root}/../../functions/delete-media"
  output_path = "${path.root}/build/lambda_query_6.zip"
}

resource "aws_iam_role" "lambda_exec_query_6" {
  name               = "${var.app_name}-${var.environment}-delete-media"
  assume_role_policy = local.assume_role_policy_json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_6_basic" {
  role       = aws_iam_role.lambda_exec_query_6.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_6_dynamodb" {
  role       = aws_iam_role.lambda_exec_query_6.name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

# Q6 only — S3 delete permissions (least privilege)
resource "aws_iam_role_policy_attachment" "lambda_exec_query_6_s3" {
  role       = aws_iam_role.lambda_exec_query_6.name
  policy_arn = aws_iam_policy.s3_delete_access.arn
}

resource "aws_lambda_function" "query_6" {
  function_name    = "${var.app_name}-${var.environment}-delete-media"
  role             = aws_iam_role.lambda_exec_query_6.arn
  handler          = "handler.handle"
  runtime          = "python3.11"
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
  route_key          = "POST /delete-media"
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


# ------------------------------ QUERY 7 — list all files ----------------------
data "archive_file" "lambda_query_7" {
  type        = "zip"
  source_dir  = "${path.root}/../../functions/list-all-files"
  output_path = "${path.root}/build/lambda_query_7.zip"
}

resource "aws_iam_role" "lambda_exec_query_7" {
  name               = "${var.app_name}-${var.environment}-list-all-files"
  assume_role_policy = local.assume_role_policy_json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_7_basic" {
  role       = aws_iam_role.lambda_exec_query_7.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_7_dynamodb" {
  role       = aws_iam_role.lambda_exec_query_7.name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

# S3 GetObject on media bucket — needed for presigned thumbnail URL generation
resource "aws_iam_policy" "s3_get_object_access" {
  name = "${var.app_name}-${var.environment}-s3-get-object-access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "${local.persistent_state.media_bucket_arn}/*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_exec_query_7_s3" {
  role       = aws_iam_role.lambda_exec_query_7.name
  policy_arn = aws_iam_policy.s3_get_object_access.arn
}

resource "aws_lambda_function" "query_7" {
  function_name    = "${var.app_name}-${var.environment}-list-all-files"
  role             = aws_iam_role.lambda_exec_query_7.arn
  handler          = "handler.handle"
  runtime          = "python3.11"
  filename         = data.archive_file.lambda_query_7.output_path
  source_code_hash = data.archive_file.lambda_query_7.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.media_files.name
      AWS_REGION_NAME     = var.aws_region
    }
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "query_7" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.query_7.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "query_7" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /all-files"
  target             = "integrations/${aws_apigatewayv2_integration.query_7.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "query_7" {
  statement_id  = "AllowAPIGatewayInvokeQuery7"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.query_7.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

