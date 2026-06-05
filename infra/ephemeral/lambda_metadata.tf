# Metadata Lambda — writes DynamoDB records when a thumbnail lands in S3.
# Triggered by EventBridge on the thumbnails/ prefix (see eventbridge.tf).
# Kept lightweight (128 MB) since it only does an S3 HeadObject + DynamoDB PutItem.

data "archive_file" "lambda_metadata" {
  type        = "zip"
  source_dir  = "${path.root}/../../functions/on-thumbnail-created"
  output_path = "${path.root}/build/lambda_metadata.zip"
}

resource "aws_lambda_function" "metadata" {
  function_name    = "${var.app_name}-${var.environment}-on-thumbnail-created"
  role             = aws_iam_role.metadata_exec.arn
  handler          = "handler.handle"
  runtime          = "python3.11"
  filename         = data.archive_file.lambda_metadata.output_path
  source_code_hash = data.archive_file.lambda_metadata.output_base64sha256
  timeout          = 15
  memory_size      = 128

  environment {
    variables = {
      MEDIA_BUCKET_NAME   = local.persistent_state.media_bucket_name
      REGION_NAME         = var.aws_region
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.media_files.name
    }
  }

  tags = local.common_tags
}

resource "aws_iam_role" "metadata_exec" {
  name               = "${var.app_name}-${var.environment}-on-thumbnail-created"
  assume_role_policy = local.assume_role_policy_json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "metadata_exec_basic" {
  role       = aws_iam_role.metadata_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "metadata_s3_dynamo" {
  name = "${var.app_name}-${var.environment}-on-thumbnail-created-s3-dynamo"
  role = aws_iam_role.metadata_exec.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadS3Metadata"
        Effect   = "Allow"
        # HeadObject API call requires s3:GetObject in IAM, not s3:HeadObject.
        # s3:HeadObject does not exist as a separate IAM action.
        Action   = ["s3:GetObject"]
        Resource = [
          "arn:aws:s3:::${local.persistent_state.media_bucket_name}/thumbnails/*",
          "arn:aws:s3:::${local.persistent_state.media_bucket_name}/videos/*"
        ]
      },
      {
        Sid      = "WriteDynamoDB"
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem"]
        Resource = aws_dynamodb_table.media_files.arn
      }
    ]
  })
}
