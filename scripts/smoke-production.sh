#!/usr/bin/env bash
set -euo pipefail

: "${APP_PUBLIC_URL:?必须设置 APP_PUBLIC_URL}"
base_url="${APP_PUBLIC_URL%/}"

check_url() {
  local path="$1"
  local expected="$2"
  local status
  status="$(curl --silent --show-error --location --output /dev/null --write-out '%{http_code}' \
    --connect-timeout 5 --max-time 20 "${base_url}${path}")"
  if [[ "$status" != "$expected" ]]; then
    echo "检查失败：${path} 返回 ${status}，预期 ${expected}" >&2
    exit 1
  fi
  echo "检查通过：${path} -> ${status}"
}

read_header() {
  local path="$1"
  local header_name="$2"
  curl --silent --show-error --location --head \
    --connect-timeout 5 --max-time 20 "${base_url}${path}" \
    | tr -d '\r' \
    | awk -F ': *' -v expected_name="$header_name" \
      'tolower($1) == tolower(expected_name) { value = $2 } END { print value }'
}

require_header() {
  local path="$1"
  local header_name="$2"
  local expected_value="$3"
  local actual_value
  actual_value="$(read_header "$path" "$header_name")"
  if [[ "$actual_value" != *"$expected_value"* ]]; then
    echo "响应头检查失败：${path} 的 ${header_name}=${actual_value:-<缺失>}，预期包含 ${expected_value}" >&2
    exit 1
  fi
  echo "响应头检查通过：${path} ${header_name}=${actual_value}"
}

reject_header() {
  local path="$1"
  local header_name="$2"
  local actual_value
  actual_value="$(read_header "$path" "$header_name")"
  if [[ -n "$actual_value" ]]; then
    echo "响应头检查失败：公开路径 ${path} 不应返回 ${header_name}=${actual_value}" >&2
    exit 1
  fi
  echo "响应头检查通过：公开路径 ${path} 未返回 ${header_name}"
}

check_url "/" "200"
check_url "/privacy" "200"
check_url "/login" "200"
check_url "/robots.txt" "200"
check_url "/sitemap.xml" "200"
check_url "/api/health" "200"
check_url "/api/ready" "200"

require_header "/" "Strict-Transport-Security" "max-age=31536000"
require_header "/" "X-Frame-Options" "DENY"
require_header "/preview/smoke-private-route" "X-Frame-Options" "SAMEORIGIN"
require_header "/" "X-Content-Type-Options" "nosniff"
require_header "/settings/account" "X-Robots-Tag" "noindex, nofollow"
require_header "/showcases/smoke-private-route" "X-Robots-Tag" "noindex, nofollow"
require_header "/vip/claim" "X-Robots-Tag" "noindex, nofollow"
reject_header "/privacy" "X-Robots-Tag"
