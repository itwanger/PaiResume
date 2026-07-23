#!/usr/bin/env bash
set -euo pipefail

: "${RESTORE_FILE:?必须设置 RESTORE_FILE}"
: "${RESTORE_TARGET_DATABASE:?必须设置 RESTORE_TARGET_DATABASE}"
: "${MYSQL_USERNAME:?必须设置 MYSQL_USERNAME}"

if [[ ! "$RESTORE_TARGET_DATABASE" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "RESTORE_TARGET_DATABASE 只能包含字母、数字和下划线" >&2
  exit 1
fi
if [[ "${RESTORE_CONFIRM:-}" != "restore:${RESTORE_TARGET_DATABASE}" ]]; then
  echo "请设置 RESTORE_CONFIRM=restore:${RESTORE_TARGET_DATABASE} 后再执行" >&2
  exit 1
fi
if [[ ! -f "$RESTORE_FILE" || "$RESTORE_FILE" != *.sql.gz ]]; then
  echo "RESTORE_FILE 必须指向存在的 .sql.gz 备份" >&2
  exit 1
fi
if [[ "${APP_ENV:-}" == "production" && "${ALLOW_PRODUCTION_RESTORE:-false}" != "true" ]]; then
  echo "拒绝在 production 环境恢复；如已完成审批，显式设置 ALLOW_PRODUCTION_RESTORE=true" >&2
  exit 1
fi

gzip -t "$RESTORE_FILE"
checksum_file="${RESTORE_FILE}.sha256"
if [[ ! -f "$checksum_file" ]]; then
  echo "缺少备份校验文件：${checksum_file}" >&2
  exit 1
fi
(
  cd "$(dirname "$RESTORE_FILE")"
  shasum -a 256 --check "$(basename "$checksum_file")"
)
mysql_args=(
  --host="${MYSQL_HOST:-127.0.0.1}"
  --port="${MYSQL_PORT:-3306}"
  --user="$MYSQL_USERNAME"
)
if [[ -n "${MYSQL_CONFIG_FILE:-}" ]]; then
  mysql_args=(--defaults-extra-file="$MYSQL_CONFIG_FILE" "${mysql_args[@]}")
fi

gzip -dc "$RESTORE_FILE" | mysql "${mysql_args[@]}" "$RESTORE_TARGET_DATABASE"
echo "恢复完成：${RESTORE_TARGET_DATABASE}"
