# Aussie Ecolens

## Table of Contents

- [OpenID Configuration](#openid-configuration)
- [How to Add Lambda Function](#how-to-add-lambda-function)
  - [1. Create python file for lambda function](#1-create-python-file-for-lambda-function)
  - [2. Terraform: `lambda_*.tf` configuration](#2-terraform-lambda_tf-configuration)
  - [3. Terraform: routing lambda through API Gateway](#3-terraform-routing-lambda-through-api-gateway)

## OpenID Configuration

```
{cognito_issuer}/.well-known/openid-configuration
```

## How to Add Lambda Function

### 1. Create python file for lambda function

- create folder under `functions`, e.g., `alambda` to reflect lambda name.
- snake case for folder name.
- the filename must be `lambda_function.py`.

```
./functions/alambda/lambda_function.py
```

### 2. Terraform: `lambda_*.tf` configuration

Create `lambda_<<lambda name>>.tf` file inside `infra` folder.

Content:

```
data "archive_file" "lambda_<<lambda_name>>" {
  type        = "zip"
  source_dir  = "${path.module}/../functions/<<lambda_name>>"
  output_path = "${path.module}/build/lambda_<<lambda_name>>.zip"
}

resource "aws_lambda_function" "<<lambda_name>>" {
  function_name = "${var.app_name}-${var.environment}-<<lambda_name>>"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "lambda_function.handler"
  runtime       = "python3.11"

  filename         = data.archive_file.lambda_<<lambda_name>>.output_path
  source_code_hash = data.archive_file.lambda_<<lambda_name>>.output_base64sha256

  tags = local.common_tags
}
```

### 3. Terraform: routing lambda through API Gateway

Create `api_gateway_<<lambda_name>>.tf` file inside `infra` folder.

Content: 

```
resource "aws_apigatewayv2_integration" "<<lambda_name>>" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.<<lambda_name>>.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "<<lambda_name>>" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /<<lambda_path>>" # e.g., /hello
  target             = "integrations/${aws_apigatewayv2_integration.<<lambda_name>>.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}
```

Update `api_gateway_base.tf`

```
locals {
  api_lambda_functions = {
    hello = aws_lambda_function.hello
    # add your new lambda here
  }
}
```