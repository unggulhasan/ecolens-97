output "accept_function_url" {
  description = "HTTPS trigger URL for the accept Cloud Function"
  value       = google_cloudfunctions2_function.accept.url
}
