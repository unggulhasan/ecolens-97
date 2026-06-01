locals {
  common_tags = {
    App         = var.app_name
    Environment = var.environment
  }

  cognito_issuer = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
}
