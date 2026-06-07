variable "aws_region" {
  description = "AWS region where the state bucket and lock table are created"
  type        = string
  default     = "ap-southeast-4"
}

variable "app_name" {
  description = "Application name prefix used for resource naming"
  type        = string
  default     = "aussie-ecolens"
}
