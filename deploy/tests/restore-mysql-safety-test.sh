#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
restore_script="${repo_root}/scripts/restore-mysql.sh"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/pairesume-restore-safety.XXXXXX")"
backup_root="${test_root}/backups"
outside_root="${test_root}/outside"
fake_bin="${test_root}/bin"
lock_root="${test_root}/locks"
socket_path="${test_root}/mysql.sock"
backup_basename="pai_resume-20260724T000000Z.sql.gz"
backup_file="${backup_root}/${backup_basename}"
checksum_file="${backup_file}.sha256"
temporary_database="pai_resume_restore_verify"
pass_count=0

cleanup() {
  rm -rf "$test_root"
}
trap cleanup EXIT

test_fail() {
  echo "FAIL: $*" >&2
  if [[ -f "${test_root}/last-output.log" ]]; then
    echo "---- restore output ----" >&2
    sed -n '1,160p' "${test_root}/last-output.log" >&2
  fi
  exit 1
}

mkdir -p "$backup_root" "$outside_root" "$fake_bin" "$lock_root"

cat >"${fake_bin}/flock" <<'FAKE_FLOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"${FAKE_FLOCK_LOG:?}"
if [[ "${FAKE_FLOCK_FAIL_FD:-}" == "${2:-}" ]]; then
  exit 1
fi
FAKE_FLOCK

cat >"${fake_bin}/systemctl" <<'FAKE_SYSTEMCTL'
#!/usr/bin/env bash
set -euo pipefail
[[ "${1:-}" == "is-active" && "${2:-}" == "pai-resume.service" ]] || exit 64
count=0
if [[ -f "${FAKE_SYSTEMCTL_COUNT_FILE:?}" ]]; then
  read -r count <"$FAKE_SYSTEMCTL_COUNT_FILE"
fi
count=$((count + 1))
printf '%s\n' "$count" >"$FAKE_SYSTEMCTL_COUNT_FILE"
state="${FAKE_SERVICE_STATE:-inactive}"
if [[ "$count" -ge 2 && -n "${FAKE_SERVICE_STATE_SECOND:-}" ]]; then
  state="$FAKE_SERVICE_STATE_SECOND"
fi
printf '%s\n' "$state"
[[ "$state" == "active" ]]
FAKE_SYSTEMCTL

cat >"${fake_bin}/mysql" <<'FAKE_MYSQL'
#!/usr/bin/env bash
set -euo pipefail
printf 'called\n' >>"${FAKE_MYSQL_CALLS_LOG:?}"
: >"${FAKE_MYSQL_ARGS_LOG:?}"
for argument in "$@"; do
  printf '%s\n' "$argument" >>"$FAKE_MYSQL_ARGS_LOG"
done
/bin/cat >"${FAKE_MYSQL_INPUT_LOG:?}"
FAKE_MYSQL

chmod 0755 "${fake_bin}/flock" "${fake_bin}/systemctl" "${fake_bin}/mysql"
touch "$socket_path"

write_backup() {
  local sql_content="$1"
  local checksum

  printf '%s\n' "$sql_content" | gzip -c >"$backup_file"
  checksum="$(sha256sum "$backup_file")"
  checksum="${checksum%% *}"
  printf '%s  %s\n' "$checksum" "$backup_basename" >"$checksum_file"
}

current_checksum() {
  local checksum

  checksum="$(sha256sum "$backup_file")"
  printf '%s' "${checksum%% *}"
}

reset_fake_logs() {
  rm -f \
    "${test_root}/flock.log" \
    "${test_root}/mysql-args.log" \
    "${test_root}/mysql-calls.log" \
    "${test_root}/mysql-input.sql" \
    "${test_root}/systemctl-count"
}

run_restore() {
  local target_database="$1"
  local checksum
  shift

  reset_fake_logs
  checksum="$(current_checksum)"
  env \
    "PATH=${fake_bin}:${PATH}" \
    "RESTORE_SAFETY_TEST_MODE=true" \
    "RESTORE_TEST_BACKUP_ROOT=${backup_root}" \
    "RESTORE_TEST_DEPLOY_LOCK_FILE=${lock_root}/deploy.lock" \
    "RESTORE_TEST_BACKUP_LOCK_FILE=${lock_root}/mysql-backup.lock" \
    "RESTORE_FILE=${backup_file}" \
    "RESTORE_TARGET_DATABASE=${target_database}" \
    "RESTORE_CONFIRM=restore:${target_database}:${checksum}" \
    "ALLOW_PRODUCTION_RESTORE=false" \
    "MYSQL_USERNAME=root" \
    "MYSQL_SOCKET=${socket_path}" \
    "MYSQL_CONFIG_FILE=" \
    "RESTORE_TEST_ASSUME_SOCKET=true" \
    "FAKE_FLOCK_LOG=${test_root}/flock.log" \
    "FAKE_FLOCK_FAIL_FD=" \
    "FAKE_SERVICE_STATE=inactive" \
    "FAKE_SERVICE_STATE_SECOND=" \
    "FAKE_SYSTEMCTL_COUNT_FILE=${test_root}/systemctl-count" \
    "FAKE_MYSQL_ARGS_LOG=${test_root}/mysql-args.log" \
    "FAKE_MYSQL_CALLS_LOG=${test_root}/mysql-calls.log" \
    "FAKE_MYSQL_INPUT_LOG=${test_root}/mysql-input.sql" \
    "$@" \
    /bin/bash "$restore_script" >"${test_root}/last-output.log" 2>&1
}

expect_failure() {
  local name="$1"
  local expected_message="$2"
  local target_database="$3"
  shift 3

  if run_restore "$target_database" "$@"; then
    test_fail "${name}：命令意外成功"
  fi
  grep -F "$expected_message" "${test_root}/last-output.log" >/dev/null \
    || test_fail "${name}：未找到预期错误：${expected_message}"
  pass_count=$((pass_count + 1))
  echo "PASS: ${name}"
}

assert_mysql_not_called() {
  local name="$1"

  if [[ -s "${test_root}/mysql-calls.log" ]]; then
    test_fail "${name}：拒绝路径仍调用了 mysql"
  fi
}

write_backup $'CREATE TABLE resume_restore_probe (id BIGINT PRIMARY KEY);\nINSERT INTO resume_restore_probe VALUES (1);'

expect_failure \
  "生产库缺少显式授权" \
  "恢复 pai_resume 必须显式设置 ALLOW_PRODUCTION_RESTORE=true" \
  "pai_resume"
assert_mysql_not_called "生产库缺少显式授权"

expect_failure \
  "测试模式不能绕过生产库保护" \
  "安全测试模式禁止恢复生产库 pai_resume" \
  "pai_resume" \
  "ALLOW_PRODUCTION_RESTORE=true"
assert_mysql_not_called "测试模式不能绕过生产库保护"

expect_failure \
  "默认生产用途 fail-closed" \
  "生产主机上的任何恢复都必须显式设置 ALLOW_PRODUCTION_RESTORE=true" \
  "$temporary_database" \
  "RESTORE_SAFETY_TEST_MODE=false"
assert_mysql_not_called "默认生产用途 fail-closed"

expect_failure \
  "拒绝任意数据库名" \
  "目标库只能是 pai_resume 或以 pai_resume_restore_ 开头的明确临时库" \
  "another_database"
assert_mysql_not_called "拒绝任意数据库名"

expect_failure \
  "固定 root 用户" \
  "MYSQL_USERNAME 必须是 root" \
  "$temporary_database" \
  "MYSQL_USERNAME=app_user"
assert_mysql_not_called "固定 root 用户"

expect_failure \
  "必须是真实 Unix socket" \
  "MYSQL_SOCKET 必须指向存在的本地 Unix socket" \
  "$temporary_database" \
  "MYSQL_SOCKET=${test_root}/not-a-socket" \
  "RESTORE_TEST_ASSUME_SOCKET=false"
assert_mysql_not_called "必须是真实 Unix socket"

expect_failure \
  "服务 active 时拒绝恢复" \
  "pai-resume.service 必须处于 inactive 状态" \
  "$temporary_database" \
  "FAKE_SERVICE_STATE=active"
assert_mysql_not_called "服务 active 时拒绝恢复"

expect_failure \
  "部署锁冲突时拒绝恢复" \
  "无法获取部署锁" \
  "$temporary_database" \
  "FAKE_FLOCK_FAIL_FD=9"
assert_mysql_not_called "部署锁冲突时拒绝恢复"

expect_failure \
  "备份锁冲突时拒绝恢复" \
  "无法获取备份锁" \
  "$temporary_database" \
  "FAKE_FLOCK_FAIL_FD=8"
assert_mysql_not_called "备份锁冲突时拒绝恢复"

cp "$backup_file" "${outside_root}/${backup_basename}"
cp "$checksum_file" "${outside_root}/${backup_basename}.sha256"
expect_failure \
  "拒绝受控目录外的备份" \
  "RESTORE_FILE 必须直接位于受控备份目录" \
  "$temporary_database" \
  "RESTORE_FILE=${outside_root}/${backup_basename}"
assert_mysql_not_called "拒绝受控目录外的备份"

symlink_file="${backup_root}/pai_resume-20260724T000001Z.sql.gz"
ln -s "$backup_file" "$symlink_file"
expect_failure \
  "拒绝符号链接备份" \
  "RESTORE_FILE 必须是绝对路径下的普通文件且不能是符号链接" \
  "$temporary_database" \
  "RESTORE_FILE=${symlink_file}"
assert_mysql_not_called "拒绝符号链接备份"

printf '%064d  %s\n' 0 "$backup_basename" >"$checksum_file"
expect_failure \
  "拒绝错误校验和" \
  "备份 SHA-256 校验失败" \
  "$temporary_database"
assert_mysql_not_called "拒绝错误校验和"

write_backup $'USE pai_resume;\nSELECT 1;'
expect_failure \
  "拒绝数据库切换" \
  "备份包含 USE 或数据库级 DDL" \
  "$temporary_database"
assert_mysql_not_called "拒绝数据库切换"

write_backup $'source /etc/mysql/untrusted-restore.sql'
expect_failure \
  "拒绝 mysql source 客户端命令" \
  "备份包含 mysql 客户端控制命令" \
  "$temporary_database"
assert_mysql_not_called "拒绝 mysql source 客户端命令"

write_backup $'DELETE FROM `pai_resume`.`users` WHERE id = 1;'
expect_failure \
  "临时库不能限定访问生产库" \
  "临时库备份包含对生产库 pai_resume 的限定引用" \
  "$temporary_database"
assert_mysql_not_called "临时库不能限定访问生产库"

write_backup $'SELECT 1 INTO OUTFILE \'/tmp/restore-probe\';'
expect_failure \
  "临时库拒绝实例级高危 SQL" \
  "临时库备份包含可能影响实例或外部资源的高危 SQL" \
  "$temporary_database"
assert_mysql_not_called "临时库拒绝实例级高危 SQL"

write_backup $'CREATE TABLE resume_restore_probe (id BIGINT PRIMARY KEY);\nINSERT INTO resume_restore_probe VALUES (1);'
if ! run_restore "$temporary_database"; then
  test_fail "安全临时库恢复命令应成功"
fi
grep -Fx -- "-n 9" "${test_root}/flock.log" >/dev/null \
  || test_fail "成功路径未以非阻塞模式获取部署锁"
grep -Fx -- "-n 8" "${test_root}/flock.log" >/dev/null \
  || test_fail "成功路径未以非阻塞模式获取备份锁"
grep -Fx -- "--user=root" "${test_root}/mysql-args.log" >/dev/null \
  || test_fail "mysql 未固定使用 root"
grep -Fx -- "--protocol=socket" "${test_root}/mysql-args.log" >/dev/null \
  || test_fail "mysql 未固定使用 socket 协议"
grep -Fx -- "--socket=${socket_path}" "${test_root}/mysql-args.log" >/dev/null \
  || test_fail "mysql 未使用显式 Unix socket"
grep -Fx -- "--binary-mode=1" "${test_root}/mysql-args.log" >/dev/null \
  || test_fail "mysql 未禁用普通输入中的客户端命令解析"
grep -Fx -- "--one-database" "${test_root}/mysql-args.log" >/dev/null \
  || test_fail "mysql 缺少 --one-database"
grep -Fx -- "--database=${temporary_database}" "${test_root}/mysql-args.log" >/dev/null \
  || test_fail "mysql 未绑定明确临时库"
if grep -E '^(--host|--port)=' "${test_root}/mysql-args.log" >/dev/null; then
  test_fail "mysql 参数意外包含 TCP 连接选项"
fi
gzip -dc "$backup_file" >"${test_root}/expected-input.sql"
cmp "${test_root}/expected-input.sql" "${test_root}/mysql-input.sql" \
  || test_fail "mysql 收到的 SQL 与已校验备份不一致"
pass_count=$((pass_count + 1))
echo "PASS: 安全临时库恢复命令覆盖"

expect_failure \
  "执行前二次服务状态检查" \
  "在恢复前不再处于 inactive 状态" \
  "$temporary_database" \
  "FAKE_SERVICE_STATE_SECOND=active"
assert_mysql_not_called "执行前二次服务状态检查"

echo "restore-mysql 安全测试通过：${pass_count} 项"
