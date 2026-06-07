terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
  backend "s3" {
    bucket         = "aussie-ecolens-tfstate"
    key            = "persistent-gcp/terraform.tfstate"
    region         = "ap-southeast-4"
    encrypt        = true
    dynamodb_table = "aussie-ecolens-tf-locks"
  }
}
