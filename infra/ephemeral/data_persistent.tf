data "terraform_remote_state" "persistent" {
  backend = "local"
  config = {
    path = "${path.module}/../persistent/terraform.tfstate"
  }
}
