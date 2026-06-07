terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.47"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.8"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.3"
    }
  }
  backend "s3" {
    bucket         = "aussie-ecolens-tfstate"
    key            = "ephemeral-aws/terraform.tfstate"
    region         = "ap-southeast-4"
    encrypt        = true
    dynamodb_table = "aussie-ecolens-tf-locks"
  }
}
