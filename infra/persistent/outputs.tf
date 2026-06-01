output "media_bucket_name" {
  description = "S3 media bucket name"
  value       = aws_s3_bucket.s3_media.bucket
}

output "media_bucket_arn" {
  description = "S3 media bucket ARN"
  value       = aws_s3_bucket.s3_media.arn
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.main.id
}

output "cognito_domain" {
  description = "Cognito hosted UI domain"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "cognito_issuer" {
  description = "Cognito JWT issuer URL"
  value       = local.cognito_issuer
}

output "ecr_docker_registry" {
  description = "ECR Docker registry URL"
  value       = local.docker_registry
}

output "base_image_uri" {
  description = "ECR URI for the base Lambda image (opencv + numpy)"
  value       = "${local.docker_registry}/${aws_ecr_repository.registry.name}:latest"
}
