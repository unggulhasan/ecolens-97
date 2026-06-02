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
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.8"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.3"
    }
  }
  backend "local" {}
}
