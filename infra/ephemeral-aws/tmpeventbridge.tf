# ------------------------------ API DESTINATION — GCP Orchestrator -------------
resource "aws_cloudwatch_event_connection" "gcp_orchestrator" {
  name               = "${var.app_name}-${var.environment}-gcp-orchestrator"
  authorization_type = "API_KEY"

  auth_parameters {
    api_key {
      key   = "X-Callback-Secret"
      value = var.callback_secret
    }
  }
}

resource "aws_cloudwatch_event_api_destination" "gcp_orchestrator" {
  name                             = "${var.app_name}-${var.environment}-gcp-orchestrator"
  connection_arn                   = aws_cloudwatch_event_connection.gcp_orchestrator.arn
  invocation_endpoint              = var.gcp_function_url
  http_method                      = "POST"
  invocation_rate_limit_per_second = 10
}

# ------------------------------ IAM — EventBridge invoke API Destination -------
resource "aws_iam_role" "eventbridge_gcp_orchestrator" {
  name = "${var.app_name}-${var.environment}-eb-gcp-orchestrator"

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

resource "aws_iam_role_policy" "eventbridge_gcp_orchestrator" {
  name = "${var.app_name}-${var.environment}-eb-gcp-orchestrator"
  role = aws_iam_role.eventbridge_gcp_orchestrator.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["events:InvokeApiDestination"]
      Resource = aws_cloudwatch_event_api_destination.gcp_orchestrator.arn
    }]
  })
}

# ------------------------------ RULE — MetadataCreated (temporary) -------------
resource "aws_cloudwatch_event_rule" "tmp_metadata_created" {
  name        = "${var.app_name}-${var.environment}-tmp-metadata-created"
  description = "Route temporary upload MetadataCreated events to GCP Orchestrator."

  event_pattern = jsonencode({
    source      = ["ecolens.metadata.created"]
    detail-type = ["MetadataCreated"]
    detail = {
      job_type = ["temporary"]
    }
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "tmp_metadata_gcp" {
  rule     = aws_cloudwatch_event_rule.tmp_metadata_created.name
  arn      = aws_cloudwatch_event_api_destination.gcp_orchestrator.arn
  role_arn = aws_iam_role.eventbridge_gcp_orchestrator.arn

  input_transformer {
    input_paths = {
      file_id    = "$.detail.file_id"
      source_key = "$.detail.source_key"
    }
    input_template = jsonencode({
      file_id       = "<file_id>"
      presigned_url = "https://${local.persistent_state.media_bucket_name}.s3.ap-southeast-4.amazonaws.com/<source_key>"
    })
  }
}