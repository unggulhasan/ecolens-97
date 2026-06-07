terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.47"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.3"
    }
  }
  backend "s3" {
    bucket         = "aussie-ecolens-tfstate"
    key            = "persistent-aws/terraform.tfstate"
    region         = "ap-southeast-4"
    encrypt        = true
    dynamodb_table = "aussie-ecolens-tf-locks"
  }
}
