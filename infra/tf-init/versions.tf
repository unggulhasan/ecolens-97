terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.47"
    }
  }

  # Intentionally local — this module creates the remote backend used by all other modules.
  # Run once to bootstrap; do not migrate this module's state to S3.
  backend "local" {}
}

provider "aws" {
  region = var.aws_region
}
