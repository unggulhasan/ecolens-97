data "terraform_remote_state" "persistent" {
  backend = "s3"
  config = {
    bucket = "aussie-ecolens-tfstate"
    key    = "persistent-aws/terraform.tfstate"
    region = "ap-southeast-4"
  }
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}
