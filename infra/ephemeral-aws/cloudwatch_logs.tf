resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${var.app_name}-${var.environment}"
  retention_in_days = 30
  tags              = local.common_tags
}

data "aws_iam_policy_document" "api_log" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }

    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = ["${aws_cloudwatch_log_group.api.arn}:*"]
  }
}

resource "aws_cloudwatch_log_resource_policy" "api" {
  policy_name     = "${var.app_name}-${var.environment}-apigw"
  policy_document = data.aws_iam_policy_document.api_log.json
}
