# Trigger thumbnail Lambda from S3 Object Created events delivered via EventBridge.
resource "aws_cloudwatch_event_rule" "trigger_thumbnail" {
  name        = "${var.app_name}-${var.environment}-on-media-uploaded-images-created"
  description = "Trigger media Lambda when an object is created in the images/ prefix."

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
  name        = "${var.app_name}-${var.environment}-on-thumbnail-created-thumb-created"
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

# Trigger media Lambda when a video lands in the videos/ prefix.
resource "aws_cloudwatch_event_rule" "trigger_thumbnail_video" {
  name        = "${var.app_name}-${var.environment}-on-media-uploaded-videos-created"
  description = "Trigger media Lambda when an object is created in the videos/ prefix."

  event_pattern = jsonencode({
    source      = ["aws.s3"]
    detail-type = ["Object Created"]
    detail = {
      bucket = {
        name = [local.persistent_state.media_bucket_name]
      }
      object = {
        key = [{ prefix = "videos/" }]
      }
    }
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "thumbnail_video" {
  rule = aws_cloudwatch_event_rule.trigger_thumbnail_video.name
  arn  = aws_lambda_function.thumbnail.arn
}

resource "aws_lambda_permission" "thumbnail_eventbridge_video" {
  statement_id  = "AllowEventBridgeInvokeVideo"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.thumbnail.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.trigger_thumbnail_video.arn
}

# Trigger on-tmp-uploaded Lambda when an object lands in the tmp/images/ prefix.
resource "aws_cloudwatch_event_rule" "trigger_tmp_images" {
  name        = "${var.app_name}-${var.environment}-on-tmp-uploaded-images-created"
  description = "Trigger on-tmp-uploaded Lambda when an object is created in the tmp/images/ prefix."

  event_pattern = jsonencode({
    source      = ["aws.s3"]
    detail-type = ["Object Created"]
    detail = {
      bucket = {
        name = [local.persistent_state.media_bucket_name]
      }
      object = {
        key = [{ prefix = "tmp/images/" }]
      }
    }
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "tmp_images" {
  rule = aws_cloudwatch_event_rule.trigger_tmp_images.name
  arn  = aws_lambda_function.tmp_uploaded.arn
}

resource "aws_lambda_permission" "tmp_images_eventbridge" {
  statement_id  = "AllowEventBridgeInvokeTmpImages"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tmp_uploaded.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.trigger_tmp_images.arn
}

# Trigger on-tmp-uploaded Lambda when an object lands in the tmp/videos/ prefix.
resource "aws_cloudwatch_event_rule" "trigger_tmp_videos" {
  name        = "${var.app_name}-${var.environment}-on-tmp-uploaded-videos-created"
  description = "Trigger on-tmp-uploaded Lambda when an object is created in the tmp/videos/ prefix."

  event_pattern = jsonencode({
    source      = ["aws.s3"]
    detail-type = ["Object Created"]
    detail = {
      bucket = {
        name = [local.persistent_state.media_bucket_name]
      }
      object = {
        key = [{ prefix = "tmp/videos/" }]
      }
    }
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "tmp_videos" {
  rule = aws_cloudwatch_event_rule.trigger_tmp_videos.name
  arn  = aws_lambda_function.tmp_uploaded.arn
}

resource "aws_lambda_permission" "tmp_videos_eventbridge" {
  statement_id  = "AllowEventBridgeInvokeTmpVideos"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tmp_uploaded.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.trigger_tmp_videos.arn
}
