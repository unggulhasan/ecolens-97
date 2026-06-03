# Trigger thumbnail Lambda from S3 Object Created events delivered via EventBridge.
resource "aws_cloudwatch_event_rule" "trigger_thumbnail" {
  name        = "${var.app_name}-${var.environment}-thumbnail-s3-created"
  description = "Trigger thumbnail Lambda when an object is created in the images/ prefix."

  event_pattern = jsonencode({
    source      = ["aws.s3"]
    detail-type = ["Object Created"]
    detail = {
      bucket = {
        name = [local.persistent_state.media_bucket_name]
      }
      object = {
        key = [{ prefix = "images/" }]
      }
    }
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "thumbnail" {
  rule = aws_cloudwatch_event_rule.trigger_thumbnail.name
  arn  = aws_lambda_function.thumbnail.arn
}

resource "aws_lambda_permission" "thumbnail_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.thumbnail.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.trigger_thumbnail.arn
}

# Trigger metadata Lambda when a thumbnail lands in the thumbnails/ prefix.
resource "aws_cloudwatch_event_rule" "trigger_metadata" {
  name        = "${var.app_name}-${var.environment}-metadata-thumb-created"
  description = "Trigger metadata Lambda when a thumbnail is written to the thumbnails/ prefix."

  event_pattern = jsonencode({
    source      = ["aws.s3"]
    detail-type = ["Object Created"]
    detail = {
      bucket = {
        name = [local.persistent_state.media_bucket_name]
      }
      object = {
        key = [{ prefix = "thumbnails/" }]
      }
    }
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "metadata" {
  rule = aws_cloudwatch_event_rule.trigger_metadata.name
  arn  = aws_lambda_function.metadata.arn
}

resource "aws_lambda_permission" "metadata_eventbridge" {
  statement_id  = "AllowEventBridgeInvokeMetadata"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.metadata.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.trigger_metadata.arn
}
