data "terraform_remote_state" "persistent" {
  backend = "local"
  config = {
    path = "${path.module}/../persistent-aws/terraform.tfstate"
  }
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}
