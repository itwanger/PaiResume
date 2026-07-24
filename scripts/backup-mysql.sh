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
backup_lock_file="${BACKUP_LOCK_FILE:-${backup_dir_real}/.mysql-backup.lock}"
backup_retention_days="${BACKUP_RETENTION_DAYS:-30}"

if [[ "$backup_lock_file" != /* ]]; then
  echo "BACKUP_LOCK_FILE 必须是绝对路径" >&2
  exit 1
fi
if [[ -L "$backup_lock_file" || ( -e "$backup_lock_file" && ! -f "$backup_lock_file" ) ]]; then
  echo "BACKUP_LOCK_FILE 必须是普通文件且不能是符号链接" >&2
  exit 1
fi
backup_lock_parent="$(dirname "$backup_lock_file")"
if [[ ! -d "$backup_lock_parent" ]]; then
  echo "BACKUP_LOCK_FILE 的父目录不存在：${backup_lock_parent}" >&2
  exit 1
fi
if [[ ! "$backup_retention_days" =~ ^[0-9]+$ \
  || "$backup_retention_days" -lt 1 \
  || "$backup_retention_days" -gt 3650 ]]; then
  echo "BACKUP_RETENTION_DAYS 必须是 1 到 3650 之间的整数" >&2
  exit 1
fi
if ! command -v flock >/dev/null 2>&1; then
  echo "缺少 flock，无法防止并发备份" >&2
  exit 1
fi

exec 9>"$backup_lock_file"
chmod 0600 "$backup_lock_file"
if ! flock -n 9; then
  echo "已有 pai_resume MySQL 备份正在执行，拒绝并发运行" >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output_file="${backup_dir_real}/${MYSQL_DATABASE}-${timestamp}.sql.gz"
checksum_file="${output_file}.sha256"
partial_file="${output_file}.partial.$$"
partial_checksum="${checksum_file}.partial.$$"

if [[ -e "$output_file" || -e "$checksum_file" ]]; then
  echo "同名备份已存在，拒绝覆盖：${output_file}" >&2
  exit 1
fi

sha256_file() {
  local path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$path" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$path" | awk '{print $1}'
  else
    echo "缺少 sha256sum 或 shasum，无法生成备份校验文件" >&2
    return 1
  fi
}

prune_expired_backups() {
  local backup_name_pattern
  local candidate
  backup_name_pattern="${MYSQL_DATABASE}-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z.sql.gz"

  while IFS= read -r -d '' candidate; do
    rm -f -- "$candidate" "${candidate}.sha256"
  done < <(
    find "$backup_dir_real" \
      -mindepth 1 \
      -maxdepth 1 \
      -type f \
      -name "$backup_name_pattern" \
      -mtime "+${backup_retention_days}" \
      -print0
  )
}

published=false
cleanup() {
  rm -f -- "$partial_file" "$partial_checksum"
  if [[ "$published" != "true" ]]; then
    rm -f -- "$output_file" "$checksum_file"
  fi
}
trap cleanup EXIT

mysql_args=(
  --user="$MYSQL_USERNAME"
)
if [[ "$MYSQL_USERNAME" == "root" && -z "${MYSQL_SOCKET:-}" ]]; then
  echo "root 备份必须显式设置本地 MYSQL_SOCKET，拒绝通过 TCP 连接" >&2
  exit 1
fi
if [[ -n "${MYSQL_CONFIG_FILE:-}" ]]; then
  if [[ "$MYSQL_CONFIG_FILE" != /* || ! -r "$MYSQL_CONFIG_FILE" ]]; then
    echo "MYSQL_CONFIG_FILE 必须是可读取的绝对路径" >&2
    exit 1
  fi
  mysql_args=(--defaults-extra-file="$MYSQL_CONFIG_FILE" "${mysql_args[@]}")
fi
if [[ -n "${MYSQL_SOCKET:-}" ]]; then
  if [[ "$MYSQL_SOCKET" != /* ]]; then
    echo "MYSQL_SOCKET 必须是绝对路径" >&2
    exit 1
  fi
  mysql_args+=(--protocol=socket --socket="$MYSQL_SOCKET")
else
  mysql_args+=(--host="${MYSQL_HOST:-127.0.0.1}" --port="${MYSQL_PORT:-3306}")
fi

mysqldump "${mysql_args[@]}" \
  --single-transaction \
  --triggers \
  --events \
  --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 \
  "$MYSQL_DATABASE" | gzip -9 > "$partial_file"

gzip -t "$partial_file"
backup_checksum="$(sha256_file "$partial_file")"
printf '%s  %s\n' "$backup_checksum" "$(basename "$output_file")" > "$partial_checksum"
mv -- "$partial_file" "$output_file"
mv -- "$partial_checksum" "$checksum_file"
published=true
prune_expired_backups
trap - EXIT
echo "$output_file"
