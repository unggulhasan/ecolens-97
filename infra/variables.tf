variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
  default     = "aussie-ecolens"
}

variable "aws_region" {
  description = "AWS region for primary deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

variable "cognito_domain_prefix" {
  description = "Cognito hosted UI domain prefix"
  type        = string
  default     = "aussie-ecolens"
}

variable "sns_notification_email" {
  description = "Email address for SNS tag notification subscriptions"
  type        = string
}

variable "model_bucket_name" {
  description = "S3 bucket name for ML model storage"
  type        = string
}

variable "media_bucket_name" {
  description = "S3 bucket name for user uploads and thumbnails"
  type        = string
}

variable "gcp_project_id" {
  description = "GCP project ID for secondary cloud resources"
  type        = string
}
