resource "local_file" "frontend_env" {
  content  = templatefile("${path.module}/frontend.env.tftpl", local.frontend_env_vars)
  filename = "${path.root}/../../frontend/.env.local"
}
