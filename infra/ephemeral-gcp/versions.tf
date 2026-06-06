terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.8"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
  backend "local" {}
}
