data "terraform_remote_state" "persistent" {
  backend = "local"
  config = {
    path = "${path.module}/../persistent-gcp/terraform.tfstate"
  }
}
