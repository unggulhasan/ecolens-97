#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# deploy.sh — Orchestrate cross-cloud Terraform apply
#
# Resolves the circular dependency between ephemeral-gcp and
# ephemeral-aws by applying in order and piping outputs between
# modules automatically:
#
#   ephemeral-gcp  ──gcp_function_url──▶  ephemeral-aws
#   ephemeral-aws  ──inference_results_url──▶  ephemeral-gcp
#
# Usage:
#   ./deploy.sh [--skip-persistent] [--skip-gcp|--skip-aws] [--auto-approve]
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Flags ────────────────────────────────────────────────────
SKIP_PERSISTENT=false
SKIP_GCP=false
SKIP_AWS=false
AUTO_APPROVE=""

for arg in "$@"; do
  case "$arg" in
    --skip-persistent) SKIP_PERSISTENT=true ;;
    --skip-gcp)        SKIP_GCP=true ;;
    --skip-aws)        SKIP_AWS=true ;;
    --auto-approve)    AUTO_APPROVE="-auto-approve" ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

# ── Helpers ──────────────────────────────────────────────────
say() { printf "\n\033[1;36m═══ %s ═══\033[0m\n" "$*"; }

tf_apply() {
  local dir="$1"
  say "Applying $dir"
  (cd "$SCRIPT_DIR/$dir" && terraform init && terraform apply $AUTO_APPROVE)
}

# ── Step 1: persistent modules (can run in parallel) ─────────
if [ "$SKIP_PERSISTENT" = false ]; then
  if [ "$SKIP_GCP" = false ]; then
    tf_apply persistent-gcp
  fi
  if [ "$SKIP_AWS" = false ]; then
    tf_apply persistent-aws
  fi
fi

# ── Step 2: ephemeral-gcp ────────────────────────────────────
if [ "$SKIP_GCP" = false ]; then
  tf_apply ephemeral-gcp

  GCP_FN_URL=$(cd "$SCRIPT_DIR/ephemeral-gcp" && terraform output -raw gcp_function_url)
  say "gcp_function_url = $GCP_FN_URL"
else
  # Read existing output even when skipping apply
  GCP_FN_URL=$(cd "$SCRIPT_DIR/ephemeral-gcp" && terraform output -raw gcp_function_url)
fi

# ── Step 3: ephemeral-aws (inject gcp_function_url) ──────────
if [ "$SKIP_AWS" = false ]; then
  say "Applying ephemeral-aws (TF_VAR_gcp_function_url injected)"
  (cd "$SCRIPT_DIR/ephemeral-aws" && \
    TF_VAR_gcp_function_url="$GCP_FN_URL" \
    terraform init && terraform apply $AUTO_APPROVE)

  AWS_RESULTS_URL=$(cd "$SCRIPT_DIR/ephemeral-aws" && terraform output -raw inference_results_url)
  say "inference_results_url = $AWS_RESULTS_URL"
else
  AWS_RESULTS_URL=$(cd "$SCRIPT_DIR/ephemeral-aws" && terraform output -raw inference_results_url)
fi

# ── Step 4: re-apply ephemeral-gcp (inject aws_results_url) ──
if [ "$SKIP_GCP" = false ]; then
  say "Re-applying ephemeral-gcp (TF_VAR_aws_results_url injected)"
  (cd "$SCRIPT_DIR/ephemeral-gcp" && \
    TF_VAR_aws_results_url="[\"$AWS_RESULTS_URL\"]" \
    terraform apply $AUTO_APPROVE)
fi

say "Deploy complete"
