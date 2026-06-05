# ─────────────────────────────────────────────────────────────
# EventBridge → GCP Cloud Function (via API Destination)
#
# Pipeline:
#   1. Resolver Lambda emits `ecolens.gcp.inference` to default bus
#   2. This rule catches it
#   3. EventBridge authenticates via API_KEY (shared callback_secret)
#   4. EventBridge POSTs to the GCP Cloud Function with X-Callback-Secret header
#   5. On failure, events go to DLQ (SQS) with 10 retries over 1 hour
# ─────────────────────────────────────────────────────────────

# ── API Key Connection (EventBridge → GCP CF) ───────────────
resource "aws_cloudwatch_event_connection" "gcp_api_key" {
  name               = "${var.app_name}-${var.environment}-gcp-api-key"
  description        = "API Key connection to GCP Cloud Function using shared callback_secret"
  authorization_type = "API_KEY"

  auth_parameters {
    api_key {
      key   = "X-Callback-Secret"
      value = local.persistent_state.callback_secret_value
    }
  }
}

# ── API Destination (EventBridge → GCP CF) ───────────────────
resource "aws_cloudwatch_event_api_destination" "gcp_cf" {
  name                             = "${var.app_name}-${var.environment}-gcp-cf"
  description                      = "GCP Cloud Function inference endpoint"
  invocation_endpoint              = var.gcp_function_url
  http_method                      = "POST"
  invocation_rate_limit_per_second = 10
  connection_arn                   = aws_cloudwatch_event_connection.gcp_api_key.arn
}

# ── IAM Role for EventBridge to invoke the API Destination ───
resource "aws_iam_role" "eb_api_dest" {
  name = "${var.app_name}-${var.environment}-eb-api-dest"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "eb_api_dest" {
  role = aws_iam_role.eb_api_dest.name
  name = "${var.app_name}-${var.environment}-eb-api-dest"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["events:InvokeApiDestination"]
      Resource = aws_cloudwatch_event_api_destination.gcp_cf.arn
    }]
  })
}

# ── DLQ (SQS) ────────────────────────────────────────────────
resource "aws_sqs_queue" "gcp_inference_dlq" {
  name                      = "${var.app_name}-${var.environment}-gcp-inference-dlq"
  message_retention_seconds = 1209600 # 14 days
  sqs_managed_sse_enabled   = true

  tags = local.common_tags
}

resource "aws_sqs_queue_policy" "gcp_inference_dlq" {
  queue_url = aws_sqs_queue.gcp_inference_dlq.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.gcp_inference_dlq.arn
    }]
  })
}

# ── EventBridge Rule (ecolens.gcp.inference → GCP CF) ────────
resource "aws_cloudwatch_event_rule" "gcp_inference" {
  name        = "${var.app_name}-${var.environment}-gcp-inference"
  description = "Forwards inference requests to GCP Cloud Function"

  event_pattern = jsonencode({
    source      = ["ecolens.gcp.inference"]
    detail-type = ["GcpInferenceRequest"]
  })

  tags = local.common_tags
}

# ── Target with input transformer + retry policy + DLQ ───────
resource "aws_cloudwatch_event_target" "gcp_inference" {
  rule     = aws_cloudwatch_event_rule.gcp_inference.name
  arn      = aws_cloudwatch_event_api_destination.gcp_cf.arn
  role_arn = aws_iam_role.eb_api_dest.arn

  # Transform the event detail into the JSON payload GCP expects
  input_transformer {
    input_paths = {
      file_id       = "$.detail.file_id"
      presigned_url = "$.detail.presigned_url"
      file_type     = "$.detail.file_type"
    }
    input_template = "{\"file_id\": \"<file_id>\", \"presigned_url\": \"<presigned_url>\", \"file_type\": \"<file_type>\"}"
  }

  # Retry up to 10 times over 1 hour before sending to DLQ
  retry_policy {
    maximum_retry_attempts        = 10
    maximum_event_age_in_seconds  = 3600
  }

  # Unrecoverable failures → SQS DLQ
  dead_letter_config {
    arn = aws_sqs_queue.gcp_inference_dlq.arn
  }
}
