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

variable "aws_results_url" {
  description = "One or more AWS API Gateway POST /inference-results URLs (output of ephemeral-aws). Injected into image-processor and video-processor as a comma-separated AWS_RESULTS_URL env var; each processor fans-out to every URL independently."
  type        = list(string)
  default     = []
}
