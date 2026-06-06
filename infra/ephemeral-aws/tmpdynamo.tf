# ------------------------------ TMP QUERY TABLE --------------------------------
resource "aws_dynamodb_table" "tmp_query" {
  name         = "tmp_query"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "file_id"

  attribute {
    name = "file_id"
    type = "S"
  }

  tags = local.common_tags
}