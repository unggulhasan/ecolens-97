resource "aws_cognito_user_pool" "main" {
  name = "${var.app_name}-${var.environment}"

  auto_verified_attributes = ["email"]

  username_attributes = ["email"]

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
    string_attribute_constraints {
      min_length = 5
      max_length = 255
    }
  }

  schema {
    name                = "given_name"
    attribute_data_type = "String"
    required            = true
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 255
    }
  }

  schema {
    name                = "family_name"
    attribute_data_type = "String"
    required            = true
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 255
    }
  }

  tags = local.common_tags
}

resource "aws_cognito_user_pool_client" "main" {
  name = "${var.app_name}-${var.environment}-client"
  user_pool_id = aws_cognito_user_pool.main.id

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  enable_token_revocation             = true

  generate_secret                     = false
  prevent_user_existence_errors       = "ENABLED"
  supported_identity_providers        = ["COGNITO"]

  callback_urls = [
    "http://localhost:3000/api/auth/callback/cognito"
  ]

  logout_urls = [
    "http://localhost:3000"
  ]

  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = var.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.main.id
}
