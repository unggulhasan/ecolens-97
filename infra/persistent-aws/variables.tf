variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
  default     = "aussie-ecolens"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region for primary deployment"
  type        = string
  default     = "ap-southeast-4"
}

variable "cognito_domain_prefix" {
  description = "Cognito hosted UI domain prefix"
  type        = string
  default     = "aussie-ecolens"
}

variable "media_bucket_name" {
  description = "S3 bucket name for user uploads and thumbnails"
  type        = string
}

variable "gcp_sa_key_json" {
  description = "GCP service account key JSON for EventBridge OIDC token generation"
  type        = string
  sensitive   = true
}

variable "callback_secret" {
  description = "Shared HMAC secret for GCP-to-AWS callback authentication"
  type        = string
  sensitive   = true
}

variable "eventbridge_client_secret" {
  description = "Client secret that EventBridge presents to the Token Proxy Lambda"
  type        = string
  sensitive   = true
}
