# on-tmp-uploaded Lambda — handles S3 Object Created events for tmp/images/ and tmp/videos/.
# Lightweight zip deployment (no OpenCV); reads S3 metadata and emits MetadataCreated directly.

data "archive_file" "lambda_tmp_uploaded" {
  type        = "zip"
  source_dir  = "${path.root}/../../functions/on-tmp-uploaded"
  output_path = "${path.root}/build/lambda_tmp_uploaded.zip"
}

resource "aws_lambda_function" "tmp_uploaded" {
  function_name    = "${var.app_name}-${var.environment}-on-tmp-uploaded"
  role             = aws_iam_role.tmp_uploaded_exec.arn
  handler          = "handler.handle"
  runtime          = "python3.11"
  filename         = data.archive_file.lambda_tmp_uploaded.output_path
  source_code_hash = data.archive_file.lambda_tmp_uploaded.output_base64sha256
  timeout          = 15
  memory_size      = 128

  environment {
    variables = {
      MEDIA_BUCKET_NAME = local.persistent_state.media_bucket_name
      REGION_NAME       = var.aws_region
      EVENT_BUS_NAME    = "default"
    }
  }

  tags = local.common_tags
}

resource "aws_iam_role" "tmp_uploaded_exec" {
  name               = "${var.app_name}-${var.environment}-on-tmp-uploaded"
  assume_role_policy = local.assume_role_policy_json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "tmp_uploaded_exec_basic" {
  role       = aws_iam_role.tmp_uploaded_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "tmp_uploaded_s3_events" {
  name = "${var.app_name}-${var.environment}-on-tmp-uploaded-s3-events"
  role = aws_iam_role.tmp_uploaded_exec.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadTmpMedia"
        Effect = "Allow"
        Action = ["s3:GetObject"]
        Resource = [
          "arn:aws:s3:::${local.persistent_state.media_bucket_name}/tmp/images/*",
          "arn:aws:s3:::${local.persistent_state.media_bucket_name}/tmp/videos/*",
        ]
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
