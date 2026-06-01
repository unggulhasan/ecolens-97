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
