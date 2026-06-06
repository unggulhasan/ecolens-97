output "api_gateway_endpoint" {
  description = "HTTP API base URL (use with $default stage)"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "inference_results_url" {
  description = "Full URL for the GCP inference result callback (POST /inference-results). Copy into infra/ephemeral-gcp/terraform.tfvars as aws_results_url so image-processor and video-processor can POST results directly."
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/inference-results"
}
