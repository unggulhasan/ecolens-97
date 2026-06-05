# ─────────────────────────────────────────────────────────────
# EventBridge Event Bus Logging → CloudWatch Logs
#
# Enables live tail & searching of all events flowing through
# the default event bus.
#
# NOTE: After Terraform creates these resources, you must
# manually enable logging on the default event bus ONCE
# in the AWS Console:
#   EventBridge → Event buses → default → CloudWatch Logs → Enable
#
# After that, live tail with:
#   aws logs tail /aws/events/default --follow
# ─────────────────────────────────────────────────────────────

# ── Log group for EventBridge events ─────────────────────────
resource "aws_cloudwatch_log_group" "event_bus" {
  name              = "/aws/events/default"
  retention_in_days = 30
  tags              = local.common_tags
}

# ── Resource policy allowing EventBridge to write to the log group ──
data "aws_iam_policy_document" "event_bus_log_policy" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = ["${aws_cloudwatch_log_group.event_bus.arn}:*"]

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:events:${var.aws_region}:${data.aws_caller_identity.current.account_id}:event-bus/default"]
    }
  }
}

resource "aws_cloudwatch_log_resource_policy" "event_bus" {
  policy_name     = "${var.app_name}-${var.environment}-event-bus-logging"
  policy_document = data.aws_iam_policy_document.event_bus_log_policy.json
}
