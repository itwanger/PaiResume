#!/usr/bin/env bash
set -euo pipefail

ready_url="${READY_CHECK_URL:-http://127.0.0.1:8084/api/ready}"

if [[ ! "$ready_url" =~ ^http://(127\.0\.0\.1|localhost|\[::1\]):[0-9]+/api/ready$ ]]; then
  echo "READY_CHECK_URL 必须是本机 loopback 上的 /api/ready 地址" >&2
  exit 1
fi

if curl \
  --fail \
  --silent \
  --show-error \
  --output /dev/null \
  --connect-timeout 2 \
  --max-time 8 \
  "$ready_url"; then
  exit 0
else
  exit_code=$?
fi

echo "PaiResume 本机就绪检查失败：curl exit=${exit_code}" >&2
exit "$exit_code"
