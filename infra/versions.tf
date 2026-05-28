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
  }
  backend "local" {}
}
