data "terraform_remote_state" "persistent" {
  backend = "s3"
  config = {
    bucket = "aussie-ecolens-tfstate"
    key    = "persistent-gcp/terraform.tfstate"
    region = "ap-southeast-4"
  }
}
