#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${MYSQL_DATABASE:?必须设置 MYSQL_DATABASE}"
: "${MYSQL_USERNAME:?必须设置 MYSQL_USERNAME}"
: "${BACKUP_DIR:?必须设置 BACKUP_DIR}"

if [[ ! "$MYSQL_DATABASE" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "MYSQL_DATABASE 只能包含字母、数字和下划线" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
backup_dir_real="$(cd "$BACKUP_DIR" && pwd -P)"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output_file="${backup_dir_real}/${MYSQL_DATABASE}-${timestamp}.sql.gz"

mysql_args=(
  --host="${MYSQL_HOST:-127.0.0.1}"
  --port="${MYSQL_PORT:-3306}"
  --user="$MYSQL_USERNAME"
)
if [[ -n "${MYSQL_CONFIG_FILE:-}" ]]; then
  mysql_args=(--defaults-extra-file="$MYSQL_CONFIG_FILE" "${mysql_args[@]}")
fi

mysqldump "${mysql_args[@]}" \
  --single-transaction \
  --triggers \
  --events \
  --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 \
  "$MYSQL_DATABASE" | gzip -9 > "$output_file"

gzip -t "$output_file"
(
  cd "$backup_dir_real"
  shasum -a 256 "$(basename "$output_file")" > "$(basename "$output_file").sha256"
)
echo "$output_file"
