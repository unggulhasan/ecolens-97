# ─────────────────────────────────────────────────────────────
# Resolve & Forward Lambda
#
# Triggered by custom event `ecolens.metadata.created` (emitted by the
# metadata Lambda after a DynamoDB record is written).  Reads the record,
# generates a presigned S3 URL, then emits `ecolens.gcp.inference` for
# the EventBridge API Destination to deliver to GCP.
# ─────────────────────────────────────────────────────────────

data "archive_file" "lambda_resolver" {
  type        = "zip"
  source_dir  = "${path.root}/../../functions/resolve-and-forward"
  output_path = "${path.root}/build/lambda_resolver.zip"
}

resource "aws_lambda_function" "resolver" {
  function_name    = "${var.app_name}-${var.environment}-resolve-and-forward"
  role             = aws_iam_role.resolver.arn
  runtime          = "python3.11"
  handler          = "handler.handle"
  filename         = data.archive_file.lambda_resolver.output_path
  source_code_hash = data.archive_file.lambda_resolver.output_base64sha256
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      MEDIA_BUCKET_NAME   = local.persistent_state.media_bucket_name
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.media_files.name
      EVENT_BUS_NAME      = "default"
    }
  }

  tags = local.common_tags
}

# ── IAM ─────────────────────────────────────────────────────
resource "aws_iam_role" "resolver" {
  name = "${var.app_name}-${var.environment}-resolver"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "resolver_exec" {
  role       = aws_iam_role.resolver.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "resolver" {
  role = aws_iam_role.resolver.name
  name = "${var.app_name}-${var.environment}-resolver-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadDynamoDB"
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem"]
        Resource = aws_dynamodb_table.media_files.arn
      },
      {
        Sid      = "GetSourceObject"
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "arn:aws:s3:::${local.persistent_state.media_bucket_name}/*"
      },
      {
        Sid      = "PutEventsToDefaultBus"
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = "arn:aws:events:${var.aws_region}:${data.aws_caller_identity.current.account_id}:event-bus/default"
      }
    ]
  })
}

# ── EventBridge Rule (metadata.created → resolver) ──────────
resource "aws_cloudwatch_event_rule" "metadata_created" {
  name        = "${var.app_name}-${var.environment}-metadata-created"
  description = "Triggers the resolver Lambda when a DynamoDB record is created"

  event_pattern = jsonencode({
    source      = ["ecolens.metadata.created"]
    detail-type = ["MetadataCreated"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "metadata_to_resolver" {
  rule = aws_cloudwatch_event_rule.metadata_created.name
  arn  = aws_lambda_function.resolver.arn
}

resource "aws_lambda_permission" "resolver_eb" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.resolver.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.metadata_created.arn
}
