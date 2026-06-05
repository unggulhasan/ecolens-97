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

variable "gcp_ml_endpoint" {
  description = "GCP ML tagger endpoint URL for Query 4"
  type        = string
  default     = ""
}

variable "gcp_function_url" {
  description = "GCP Cloud Function URL that accepts inference requests from EventBridge"
  type        = string
  default     = "https://australia-southeast2-ecolens-498408.cloudfunctions.net/ecolens-prod-accept"
}