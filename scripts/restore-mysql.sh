#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly PRODUCTION_DATABASE="pai_resume"
readonly PRODUCTION_BACKUP_ROOT="/var/backups/pai-resume"
readonly PRODUCTION_DEPLOY_LOCK_FILE="/home/www/pairesume/deploy.lock"
readonly PRODUCTION_BACKUP_LOCK_FILE="/var/backups/pai-resume/.mysql-backup.lock"
readonly SERVICE_NAME="pai-resume.service"

fail() {
  echo "恢复已拒绝：$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少必需命令：$1"
}

validate_lock_target() {
  local lock_file="$1"
  local lock_parent="${lock_file%/*}"

  [[ "$lock_file" == /* ]] || fail "锁文件必须使用绝对路径：${lock_file}"
  [[ -d "$lock_parent" && ! -L "$lock_parent" ]] \
    || fail "锁目录不存在或是符号链接：${lock_parent}"
  if [[ -e "$lock_file" && ( -L "$lock_file" || ! -f "$lock_file" ) ]]; then
    fail "锁文件必须是普通文件且不能是符号链接：${lock_file}"
  fi
}

require_root_owned_private_file() {
  local file="$1"
  local description="$2"
  local owner mode

  owner="$(stat -c '%u' -- "$file")"
  mode="$(stat -c '%a' -- "$file")"
  [[ "$owner" == "0" ]] || fail "${description}必须由 root 持有：${file}"
  (( (8#$mode & 077) == 0 )) \
    || fail "${description}不能授予 group/other 任何权限：${file}"
}

require_root_owned_safe_file() {
  local file="$1"
  local description="$2"
  local owner mode

  owner="$(stat -c '%u' -- "$file")"
  mode="$(stat -c '%a' -- "$file")"
  [[ "$owner" == "0" ]] || fail "${description}必须由 root 持有：${file}"
  (( (8#$mode & 022) == 0 )) \
    || fail "${description}不能允许 group/other 写入：${file}"
}

require_root_owned_safe_directory() {
  local directory="$1"
  local description="$2"
  local owner mode

  owner="$(stat -c '%u' -- "$directory")"
  mode="$(stat -c '%a' -- "$directory")"
  [[ "$owner" == "0" ]] || fail "${description}必须由 root 持有：${directory}"
  (( (8#$mode & 022) == 0 )) \
    || fail "${description}不能允许 group/other 写入：${directory}"
}

scan_sql_for_pattern() {
  local pattern="$1"

  gzip -dc -- "$RESTORE_FILE" | LC_ALL=C grep -Eai "$pattern" >/dev/null
}

reject_matching_sql() {
  local pattern="$1"
  local reason="$2"
  local scan_status

  if scan_sql_for_pattern "$pattern"; then
    fail "$reason"
  else
    scan_status=$?
    [[ "$scan_status" -eq 1 ]] || fail "扫描备份 SQL 时发生错误"
  fi
}

: "${RESTORE_FILE:?必须设置 RESTORE_FILE}"
: "${RESTORE_TARGET_DATABASE:?必须设置 RESTORE_TARGET_DATABASE}"
: "${MYSQL_SOCKET:?必须设置 MYSQL_SOCKET}"

test_mode="${RESTORE_SAFETY_TEST_MODE:-false}"
case "$test_mode" in
  true|false) ;;
  *) fail "RESTORE_SAFETY_TEST_MODE 只能是 true 或 false" ;;
esac

if (( ${#RESTORE_TARGET_DATABASE} > 64 )); then
  fail "RESTORE_TARGET_DATABASE 不能超过 64 个字符"
fi
if [[ "$RESTORE_TARGET_DATABASE" != "$PRODUCTION_DATABASE" \
  && ! "$RESTORE_TARGET_DATABASE" =~ ^pai_resume_restore_[A-Za-z0-9][A-Za-z0-9_]*$ ]]; then
  fail "目标库只能是 pai_resume 或以 pai_resume_restore_ 开头的明确临时库"
fi

if [[ "$RESTORE_TARGET_DATABASE" == "$PRODUCTION_DATABASE" \
  && "${ALLOW_PRODUCTION_RESTORE:-false}" != "true" ]]; then
  fail "恢复 pai_resume 必须显式设置 ALLOW_PRODUCTION_RESTORE=true"
fi
if [[ "$test_mode" == "false" && "${ALLOW_PRODUCTION_RESTORE:-false}" != "true" ]]; then
  fail "生产主机上的任何恢复都必须显式设置 ALLOW_PRODUCTION_RESTORE=true"
fi
if [[ "$test_mode" == "true" && "$RESTORE_TARGET_DATABASE" == "$PRODUCTION_DATABASE" ]]; then
  fail "安全测试模式禁止恢复生产库 pai_resume"
fi
if [[ "$test_mode" == "false" && "$EUID" -ne 0 ]]; then
  fail "生产恢复脚本必须由 root 执行"
fi

mysql_username="${MYSQL_USERNAME:-root}"
[[ "$mysql_username" == "root" ]] \
  || fail "恢复固定使用本机 root 账号，MYSQL_USERNAME 必须是 root"
if [[ "$test_mode" == "true" && "${RESTORE_TEST_ASSUME_SOCKET:-false}" == "true" ]]; then
  [[ "$MYSQL_SOCKET" == /* ]] \
    || fail "安全测试模式下 MYSQL_SOCKET 仍必须是绝对路径"
else
  [[ "$MYSQL_SOCKET" == /* && -S "$MYSQL_SOCKET" ]] \
    || fail "MYSQL_SOCKET 必须指向存在的本地 Unix socket"
fi

if [[ "$test_mode" == "true" ]]; then
  : "${RESTORE_TEST_BACKUP_ROOT:?安全测试模式必须设置 RESTORE_TEST_BACKUP_ROOT}"
  : "${RESTORE_TEST_DEPLOY_LOCK_FILE:?安全测试模式必须设置 RESTORE_TEST_DEPLOY_LOCK_FILE}"
  : "${RESTORE_TEST_BACKUP_LOCK_FILE:?安全测试模式必须设置 RESTORE_TEST_BACKUP_LOCK_FILE}"
  backup_root="$RESTORE_TEST_BACKUP_ROOT"
  deploy_lock_file="$RESTORE_TEST_DEPLOY_LOCK_FILE"
  backup_lock_file="$RESTORE_TEST_BACKUP_LOCK_FILE"
else
  backup_root="$PRODUCTION_BACKUP_ROOT"
  deploy_lock_file="$PRODUCTION_DEPLOY_LOCK_FILE"
  backup_lock_file="$PRODUCTION_BACKUP_LOCK_FILE"
fi

[[ "$backup_root" == /* && -d "$backup_root" && ! -L "$backup_root" ]] \
  || fail "备份根目录必须是存在的绝对路径且不能是符号链接：${backup_root}"
[[ "$RESTORE_FILE" == /* && -f "$RESTORE_FILE" && ! -L "$RESTORE_FILE" ]] \
  || fail "RESTORE_FILE 必须是绝对路径下的普通文件且不能是符号链接"

require_command flock
require_command gzip
require_command grep
require_command mysql
require_command realpath
require_command sha256sum
require_command systemctl
require_command wc
if [[ "$test_mode" == "false" ]]; then
  require_command stat
fi

backup_root_real="$(realpath "$backup_root")"
restore_file_real="$(realpath "$RESTORE_FILE")"
[[ "${restore_file_real%/*}" == "$backup_root_real" ]] \
  || fail "RESTORE_FILE 必须直接位于受控备份目录 ${backup_root}"
# 后续校验、扫描和导入始终使用同一个规范化路径，避免路径表达差异。
RESTORE_FILE="$restore_file_real"

restore_basename="${restore_file_real##*/}"
backup_name_pattern='^pai_resume-[0-9]{8}T[0-9]{6}Z\.sql\.gz$'
[[ "$restore_basename" =~ $backup_name_pattern ]] \
  || fail "备份文件名不符合 pai_resume-YYYYMMDDTHHMMSSZ.sql.gz 格式"

checksum_file="${restore_file_real}.sha256"
[[ -f "$checksum_file" && ! -L "$checksum_file" ]] \
  || fail "缺少普通且非符号链接的校验文件：${checksum_file}"
checksum_file_real="$(realpath "$checksum_file")"
[[ "${checksum_file_real%/*}" == "$backup_root_real" ]] \
  || fail "校验文件必须直接位于受控备份目录 ${backup_root}"

if [[ "$test_mode" == "false" ]]; then
  require_root_owned_safe_directory "$backup_root_real" "备份目录"
  require_root_owned_safe_directory "${deploy_lock_file%/*}" "部署锁目录"
  require_root_owned_private_file "$restore_file_real" "备份文件"
  require_root_owned_private_file "$checksum_file_real" "校验文件"
fi

checksum_line_count="$(wc -l < "$checksum_file_real")"
[[ "$checksum_line_count" -eq 1 ]] || fail "校验文件必须且只能包含一行"
checksum_line="$(<"$checksum_file_real")"
checksum_pattern='^([0-9a-f]{64})  (pai_resume-[0-9]{8}T[0-9]{6}Z\.sql\.gz)$'
[[ "$checksum_line" =~ $checksum_pattern ]] \
  || fail "校验文件格式非法，必须是小写 SHA-256、两个空格和精确文件名"
expected_checksum="${BASH_REMATCH[1]}"
checksum_basename="${BASH_REMATCH[2]}"
[[ "$checksum_basename" == "$restore_basename" ]] \
  || fail "校验文件中的文件名与备份不一致"

actual_checksum_line="$(sha256sum -- "$restore_file_real")"
actual_checksum="${actual_checksum_line%% *}"
[[ "$actual_checksum" =~ ^[0-9a-f]{64}$ && "$actual_checksum" == "$expected_checksum" ]] \
  || fail "备份 SHA-256 校验失败"

expected_confirmation="restore:${RESTORE_TARGET_DATABASE}:${expected_checksum}"
[[ "${RESTORE_CONFIRM:-}" == "$expected_confirmation" ]] \
  || fail "请设置 RESTORE_CONFIRM=${expected_confirmation} 后再执行"

gzip -t -- "$restore_file_real" || fail "备份 gzip 完整性校验失败"

validate_lock_target "$deploy_lock_file"
validate_lock_target "$backup_lock_file"
if [[ "$test_mode" == "false" ]]; then
  if [[ -e "$deploy_lock_file" ]]; then
    require_root_owned_safe_file "$deploy_lock_file" "部署锁文件"
  fi
  if [[ -e "$backup_lock_file" ]]; then
    require_root_owned_safe_file "$backup_lock_file" "备份锁文件"
  fi
fi

exec 9>>"$deploy_lock_file"
chmod 0600 "$deploy_lock_file"
flock -n 9 || fail "无法获取部署锁 ${deploy_lock_file}，当前可能正在发布或回滚"

exec 8>>"$backup_lock_file"
chmod 0600 "$backup_lock_file"
flock -n 8 || fail "无法获取备份锁 ${backup_lock_file}，当前可能正在备份"

service_state="$(systemctl is-active "$SERVICE_NAME" 2>/dev/null || true)"
[[ "$service_state" == "inactive" ]] \
  || fail "${SERVICE_NAME} 必须处于 inactive 状态，当前状态：${service_state:-unknown}"

# 所有恢复都拒绝数据库切换、数据库级 DDL 和 mysql 客户端转义命令。
reject_matching_sql \
  '(^|[^[:alnum:]_])(USE[[:space:]]+|(CREATE|ALTER|DROP)[[:space:]]+DATABASE([[:space:]]|`|;|$))' \
  "备份包含 USE 或数据库级 DDL，拒绝执行"
reject_matching_sql \
  '^[[:space:]]*(\\(u|use|source|\.|!|system|r|connect)|(source|system|connect)[[:space:]])' \
  "备份包含 mysql 客户端控制命令，拒绝执行"

if [[ "$RESTORE_TARGET_DATABASE" != "$PRODUCTION_DATABASE" ]]; then
  # mysql --one-database 不是安全边界；临时库恢复额外拒绝生产库限定名和服务端高危语句。
  reject_matching_sql \
    '`?pai_resume`?[[:space:]]*\.[[:space:]]*`?[A-Za-z0-9_]' \
    "临时库备份包含对生产库 pai_resume 的限定引用"
  reject_matching_sql \
    '(^|[^[:alnum:]_])((CREATE|ALTER|DROP)[[:space:]]+(EVENT|USER|FUNCTION)|PREPARE[[:space:]]|EXECUTE[[:space:]]|CALL[[:space:]]|SET[[:space:]]+(@@[[:space:]]*)?GLOBAL|GRANT[[:space:]]|REVOKE[[:space:]]|INTO[[:space:]]+(OUTFILE|DUMPFILE)|LOAD[[:space:]]+(DATA|XML)|LOAD_FILE[[:space:]]*\(|INSTALL[[:space:]]|UNINSTALL[[:space:]]|SHUTDOWN([[:space:]]|;|$)|RESET[[:space:]]|PURGE[[:space:]]|FLUSH[[:space:]]|KILL[[:space:]])' \
    "临时库备份包含可能影响实例或外部资源的高危 SQL"
fi

# 锁内再次确认停机状态，缩小检查与执行之间的时间窗口。
service_state="$(systemctl is-active "$SERVICE_NAME" 2>/dev/null || true)"
[[ "$service_state" == "inactive" ]] \
  || fail "${SERVICE_NAME} 在恢复前不再处于 inactive 状态，已中止"

mysql_args=()
if [[ -n "${MYSQL_CONFIG_FILE:-}" ]]; then
  [[ "$MYSQL_CONFIG_FILE" == /* && -r "$MYSQL_CONFIG_FILE" \
    && -f "$MYSQL_CONFIG_FILE" && ! -L "$MYSQL_CONFIG_FILE" ]] \
    || fail "MYSQL_CONFIG_FILE 必须是可读取的绝对普通文件且不能是符号链接"
  if [[ "$test_mode" == "false" ]]; then
    require_root_owned_private_file "$MYSQL_CONFIG_FILE" "MySQL 配置文件"
  fi
  mysql_args+=(--defaults-extra-file="$MYSQL_CONFIG_FILE")
fi
mysql_args+=(
  --user=root
  --protocol=socket
  --socket="$MYSQL_SOCKET"
  --binary-mode=1
  --one-database
  --database="$RESTORE_TARGET_DATABASE"
)

gzip -dc -- "$restore_file_real" | mysql "${mysql_args[@]}"
echo "恢复完成：${RESTORE_TARGET_DATABASE}"
