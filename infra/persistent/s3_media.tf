resource "aws_s3_bucket" "s3_media" {
  bucket        = var.media_bucket_name
  force_destroy = true

  tags = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "s3_media" {
  bucket = aws_s3_bucket.s3_media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "s3_media" {
  bucket = aws_s3_bucket.s3_media.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "s3_media" {
  bucket = aws_s3_bucket.s3_media.id

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_bucket_notification" "s3_media_notification" {
  bucket      = aws_s3_bucket.s3_media.id
  eventbridge = true
}
