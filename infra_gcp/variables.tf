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
  description = "GCP project ID for secondary cloud resources"
  type        = string
  default     = "ecolens-497810"
}
variable "gcp_region" {
  description = "GCP Region"
  type        = string
  default     = "australia-southeast1"
}

variable "image_tag" {
  description = "Docker image tag used for inference images"
  type        = string
  default     = "dev"
}