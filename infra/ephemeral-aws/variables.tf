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

variable "auth_secret" {
  description = "AUTH_SECRET used by the frontend"
  type        = string
  sensitive   = true
}

variable "gcp_function_url" {
  description = "GCP Cloud Function URL that accepts inference requests from EventBridge (output of ephemeral-gcp)"
  type        = string
}



