variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
  default     = "ecolens"
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
