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

variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
  default     = "ecolens-498408"
}

variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "australia-southeast2"
}

variable "callback_secret" {
  description = "Shared HMAC secret for GCP-to-AWS callback authentication"
  type        = string
  sensitive   = true
}
