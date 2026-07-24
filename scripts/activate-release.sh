#!/usr/bin/env bash
set -euo pipefail
umask 022

deploy_root="/home/www/pairesume"
incoming_dir="${deploy_root}/incoming"
releases_dir="${deploy_root}/releases"
failed_dir="${deploy_root}/failed"
current_link="${deploy_root}/current"
previous_link="${deploy_root}/previous"
lock_file="${deploy_root}/deploy.lock"
bin_dir="${deploy_root}/bin"
env_file="/etc/pai-resume/pai-resume.env"
backup_dir="/var/backups/pai-resume"
log_dir="/var/log/pai-resume"
service_name="pai-resume.service"
backup_service_name="pai-resume-mysql-backup.service"
backup_timer_name="pai-resume-mysql-backup.timer"
ready_service_name="pai-resume-ready-check.service"
ready_timer_name="pai-resume-ready-check.timer"
java_bin="/usr/lib/jvm/java-17-konajdk-17.0.13-1.oc9/bin/java"
keytool_bin="/usr/lib/jvm/java-17-konajdk-17.0.13-1.oc9/bin/keytool"
truststore_file="/etc/pai-resume/mysql-truststore.jks"

archive="${1:-}"
checksum_file="${2:-${archive}.sha256}"

fail() {
  echo "发布失败：$*" >&2
  exit 1
}

validate_root_owned_file() {
  local path="$1"
  local must_be_executable="${2:-false}"
  local owner_group
  local mode

  [[ -f "$path" && ! -L "$path" ]] || fail "文件不存在、不是普通文件或是软链接：${path}"
  owner_group="$(stat -c '%U:%G' "$path")"
  mode="$(stat -c '%a' "$path")"
  [[ "$owner_group" == "root:root" ]] || fail "文件必须属于 root:root：${path}"
  if (( (8#${mode} & 022) != 0 )); then
    fail "文件不得允许 group/other 写入：${path} mode=${mode}"
  fi
  if [[ "$must_be_executable" == "true" && ! -x "$path" ]]; then
    fail "稳定控制脚本不可执行：${path}"
  fi
}

validate_root_owned_directory() {
  local path="$1"
  local owner_group
  local mode

  [[ -d "$path" && ! -L "$path" ]] || fail "目录不存在、不是目录或是软链接：${path}"
  owner_group="$(stat -c '%U:%G' "$path")"
  mode="$(stat -c '%a' "$path")"
  [[ "$owner_group" == "root:root" ]] || fail "目录必须属于 root:root：${path}"
  if (( (8#${mode} & 022) != 0 )); then
    fail "目录不得允许 group/other 写入：${path} mode=${mode}"
  fi
}

validate_installed_units() {
  local unit
  local load_state
  local fragment_path
  local main_environment
  local main_exec
  local main_working_directory
  local unit_paths=()
  local units=(
    "$service_name"
    "$backup_service_name"
    "$backup_timer_name"
    "$ready_service_name"
    "$ready_timer_name"
  )

  for unit in "${units[@]}"; do
    load_state="$(systemctl show --property=LoadState --value "$unit")"
    [[ "$load_state" == "loaded" ]] || fail "systemd unit 未正确加载：${unit} state=${load_state:-unknown}"
    fragment_path="$(systemctl show --property=FragmentPath --value "$unit")"
    [[ "$fragment_path" == /* ]] || fail "无法解析 systemd unit 文件：${unit}"
    validate_root_owned_file "$fragment_path"
    unit_paths+=("$fragment_path")
  done

  systemd-analyze verify "${unit_paths[@]}" \
    || fail "PaiResume systemd unit 校验失败"

  main_exec="$(systemctl show --property=ExecStart --value "$service_name")"
  main_working_directory="$(
    systemctl show --property=WorkingDirectory --value "$service_name"
  )"
  main_environment="$(systemctl show --property=Environment --value "$service_name")"
  [[ "$main_exec" == *"$java_bin"* \
    && "$main_exec" == *"${deploy_root}/current/server/pai-resume-server.jar"* ]] \
    || fail "${service_name} 未绑定预期 Java 17 与 PaiResume JAR"
  [[ "$main_working_directory" == "${deploy_root}/current/server" ]] \
    || fail "${service_name} WorkingDirectory 不正确"
  [[ "$main_environment" == *"$truststore_file"* ]] \
    || fail "${service_name} 未绑定专用 MySQL truststore"
}

validate_java_and_truststore() {
  local java_output
  local java_first_line

  [[ -x "$java_bin" ]] || fail "Java 17 不可执行：${java_bin}"
  [[ -x "$keytool_bin" ]] || fail "Java 17 keytool 不可执行：${keytool_bin}"
  java_output="$("$java_bin" -version 2>&1)" || fail "Java 17 无法运行"
  java_first_line="${java_output%%$'\n'*}"
  if [[ "$java_first_line" != *'version "17.'* && "$java_first_line" != *'version "17"'* ]]; then
    fail "生产 Java 必须明确为 17，实际为：${java_first_line}"
  fi

  validate_root_owned_file "$truststore_file"
  [[ -r "$truststore_file" ]] || fail "MySQL truststore 不可读：${truststore_file}"
  "$keytool_bin" -list -storetype JKS -keystore "$truststore_file" \
    -storepass changeit >/dev/null 2>&1 \
    || fail "MySQL truststore 不是可读取的有效 JKS：${truststore_file}"
}

validate_port_isolation() {
  local service_state
  service_state="$(systemctl is-active "$service_name" 2>/dev/null || true)"
  case "$service_state" in
    active)
      ;;
    inactive|failed)
      if ss -H -ltn | awk '$4 ~ /:8084$/ { found = 1 } END { exit(found ? 0 : 1) }'; then
        fail "${service_name} 未运行时 8084 已被其他进程占用"
      fi
      ;;
    *)
      fail "${service_name} 处于过渡或未知状态，拒绝发布：${service_state:-unknown}"
      ;;
  esac
}

run_host_precheck() {
  local command_name
  local nginx_bin
  local stable_script
  local stable_scripts=(
    "${bin_dir}/activate-release.sh"
    "${bin_dir}/rollback-release.sh"
    "${bin_dir}/production-preflight.sh"
    "${bin_dir}/switch-release.sh"
    "${bin_dir}/backup-mysql.sh"
    "${bin_dir}/restore-mysql.sh"
    "${bin_dir}/smoke-production.sh"
    "${bin_dir}/check-ready.sh"
  )
  local required_directory
  local required_directories=(
    "$deploy_root"
    "$bin_dir"
    "$incoming_dir"
    "$releases_dir"
    "$failed_dir"
    "$backup_dir"
    "$log_dir"
    "/etc/pai-resume"
  )

  for command_name in awk curl df flock mv readlink realpath sha256sum ss stat \
    systemctl systemd-analyze tar; do
    command -v "$command_name" >/dev/null 2>&1 \
      || fail "生产主机缺少命令：${command_name}"
  done

  for required_directory in "${required_directories[@]}"; do
    validate_root_owned_directory "$required_directory"
  done
  validate_root_owned_file "$env_file"
  if [[ "$(stat -c '%a' "$env_file")" != "600" ]]; then
    fail "生产环境文件权限必须精确为 600：${env_file}"
  fi
  for stable_script in "${stable_scripts[@]}"; do
    validate_root_owned_file "$stable_script" true
  done

  validate_installed_units
  validate_java_and_truststore

  nginx_bin="$(command -v nginx || true)"
  [[ -n "$nginx_bin" ]] || fail "生产主机缺少 nginx"
  "$nginx_bin" -t || fail "Nginx 配置检查失败"
  validate_port_isolation
}

check_disk_space() {
  local archive_bytes="$1"
  local multiplier="$2"
  local available_kib
  local available_bytes
  local required_bytes
  local required_mib
  local available_mib

  if [[ ! "$archive_bytes" =~ ^[0-9]+$ \
    || "$archive_bytes" -lt 1 \
    || "$archive_bytes" -gt 10737418240 ]]; then
    fail "archive 大小必须是 1 字节到 10 GiB 之间的整数"
  fi
  if [[ "$multiplier" != "2" && "$multiplier" != "3" ]]; then
    fail "磁盘余量倍数不合法"
  fi

  available_kib="$(df -Pk "$deploy_root" | awk 'END { print $4 }')"
  [[ "$available_kib" =~ ^[0-9]+$ ]] || fail "无法读取 PaiResume 文件系统剩余空间"
  available_bytes=$((available_kib * 1024))
  required_bytes=$((archive_bytes * multiplier + 1073741824))
  if (( available_bytes < required_bytes )); then
    required_mib=$(((required_bytes + 1048575) / 1048576))
    available_mib=$((available_bytes / 1048576))
    fail "磁盘余量不足：需要至少 ${required_mib} MiB，当前 ${available_mib} MiB"
  fi
  required_mib=$(((required_bytes + 1048575) / 1048576))
  available_mib=$((available_bytes / 1048576))
  echo "磁盘余量检查通过：需要 ${required_mib} MiB，当前 ${available_mib} MiB"
}

enable_pairesume_units() {
  systemctl enable "$service_name" "$backup_timer_name" "$ready_timer_name" \
    || return 1
  systemctl start "$backup_timer_name" "$ready_timer_name" \
    || return 1
  systemctl is-enabled --quiet "$service_name" \
    && systemctl is-enabled --quiet "$backup_timer_name" \
    && systemctl is-enabled --quiet "$ready_timer_name" \
    && systemctl is-active --quiet "$backup_timer_name" \
    && systemctl is-active --quiet "$ready_timer_name"
}

if [[ "$EUID" -ne 0 ]]; then
  fail "远端激活脚本必须由 root 执行"
fi

case "${1:-}" in
  --precheck)
    [[ "$#" -eq 1 ]] || fail "--precheck 不接受其他参数"
    run_host_precheck
    echo "PaiResume 主机只读发布前置检查通过"
    exit 0
    ;;
  --check-disk)
    [[ "$#" -eq 2 ]] || fail "--check-disk 必须提供 archive 字节数"
    run_host_precheck
    check_disk_space "$2" 3
    exit 0
    ;;
esac

run_host_precheck

if [[ -z "$archive" || "$archive" != /* || -z "$checksum_file" || "$checksum_file" != /* ]]; then
  fail "archive 和 checksum 必须是绝对路径"
fi

archive_real="$(realpath -e "$archive")"
checksum_real="$(realpath -e "$checksum_file")"
incoming_real="$(realpath -e "$incoming_dir")"
case "$archive_real" in
  "${incoming_real}/"*)
    ;;
  *)
    fail "archive 必须位于 ${incoming_real}"
    ;;
esac
case "$checksum_real" in
  "${incoming_real}/"*)
    ;;
  *)
    fail "checksum 必须位于 ${incoming_real}"
    ;;
esac

archive_basename="$(basename "$archive_real")"
if [[ ! "$archive_basename" =~ ^pairesume-([A-Za-z0-9][A-Za-z0-9._-]{0,127})\.tar\.gz$ ]]; then
  fail "archive 文件名不合法"
fi
release_name="${BASH_REMATCH[1]}"
if [[ "$(basename "$checksum_real")" != "${archive_basename}.sha256" ]]; then
  fail "checksum 文件名与 archive 不匹配"
fi

exec 9>"$lock_file"
chmod 0600 "$lock_file"
if ! flock -n 9; then
  fail "已有 PaiResume 发布或回滚正在执行"
fi

read -r expected_checksum checksum_name checksum_extra < "$checksum_real" || fail "无法读取整包校验文件"
if [[ ! "$expected_checksum" =~ ^[0-9a-f]{64}$ \
  || "$checksum_name" != "$archive_basename" \
  || -n "${checksum_extra:-}" ]]; then
  fail "整包校验文件格式不合法"
fi
actual_checksum="$(sha256sum "$archive_real" | awk '{print $1}')"
[[ "$actual_checksum" == "$expected_checksum" ]] || fail "整包 SHA-256 不匹配"
archive_size_bytes="$(stat -c '%s' "$archive_real")"
check_disk_space "$archive_size_bytes" 2

while IFS= read -r archive_entry; do
  normalized_entry="${archive_entry#./}"
  if [[ "$normalized_entry" == /* || "$normalized_entry" == ".." \
    || "$normalized_entry" == ../* || "$normalized_entry" == */../* \
    || "$normalized_entry" == */.. ]]; then
    fail "archive 包含不安全路径"
  fi
done < <(tar -tzf "$archive_real")

if tar -tvzf "$archive_real" | awk '
  substr($1, 1, 1) ~ /[lhbcps]/ { found = 1 }
  END { exit(found ? 0 : 1) }
'; then
  fail "archive 不允许包含链接或特殊文件"
fi

staging_dir="${releases_dir}/.staging-${release_name}-$$"
final_dir="${releases_dir}/${release_name}"
[[ ! -e "$staging_dir" && ! -e "$final_dir" ]] || fail "release 已存在：${release_name}"

cleanup_staging() {
  if [[ -d "$staging_dir" ]]; then
    rm -rf -- "$staging_dir"
  fi
}
trap cleanup_staging EXIT

mkdir -m 0755 "$staging_dir"
tar --extract --gzip --file "$archive_real" \
  --directory "$staging_dir" --no-same-owner --no-same-permissions

for required_file in \
  "$staging_dir/dist/index.html" \
  "$staging_dir/server/pai-resume-server.jar" \
  "$staging_dir/config/field-optimize-prompts.yml" \
  "$staging_dir/manifest/SHA256SUMS" \
  "$staging_dir/manifest/release-name" \
  "$staging_dir/manifest/target-uname"; do
  [[ -f "$required_file" ]] || fail "候选 release 缺少文件：${required_file}"
done

manifest_release_name="$(tr -d '\r\n' < "$staging_dir/manifest/release-name")"
[[ "$manifest_release_name" == "$release_name" ]] || fail "archive 名称与 manifest release name 不一致"
manifest_arch="$(tr -d '\r\n' < "$staging_dir/manifest/target-uname")"
[[ "$manifest_arch" == "$(uname -m)" ]] || fail "release 架构 ${manifest_arch} 与主机 $(uname -m) 不一致"

(
  cd "$staging_dir"
  sha256sum --quiet --check manifest/SHA256SUMS
) || fail "release 逐文件 SHA-256 校验失败"

chown -R root:root "$staging_dir"
find "$staging_dir" -type d -exec chmod 0755 {} +
find "$staging_dir" -type f -exec chmod 0644 {} +

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

preflight_script="${bin_dir}/production-preflight.sh"
switch_script="${bin_dir}/switch-release.sh"
backup_script="${bin_dir}/backup-mysql.sh"
smoke_script="${bin_dir}/smoke-production.sh"
for stable_script in "$preflight_script" "$switch_script" "$backup_script" "$smoke_script"; do
  [[ -x "$stable_script" ]] || fail "稳定控制脚本不可执行：${stable_script}"
done

RELEASE_ROOT="$staging_dir" "$preflight_script"

echo "备份 pai_resume 数据库（低优先级、只读、一致性快照）"
backup_mysql_host="${PAIRESUME_BACKUP_MYSQL_HOST:-localhost}"
backup_mysql_user="${PAIRESUME_BACKUP_MYSQL_USERNAME:-root}"
backup_mysql_socket="${PAIRESUME_BACKUP_MYSQL_SOCKET:?生产备份必须配置本地 MySQL Unix socket 绝对路径}"
backup_mysql_config="${PAIRESUME_BACKUP_MYSQL_CONFIG_FILE:-}"
[[ "$backup_mysql_user" == "root" ]] || fail "生产备份固定使用 MySQL root 本地 socket"
[[ "$backup_mysql_socket" == /* && -S "$backup_mysql_socket" ]] \
  || fail "PAIRESUME_BACKUP_MYSQL_SOCKET 必须指向存在的本地 Unix socket"
backup_command=("$backup_script")
if command -v ionice >/dev/null 2>&1 && command -v nice >/dev/null 2>&1; then
  backup_command=(ionice -c2 -n7 nice -n 10 "$backup_script")
fi
MYSQL_DATABASE=pai_resume \
MYSQL_USERNAME="$backup_mysql_user" \
MYSQL_HOST="$backup_mysql_host" \
MYSQL_SOCKET="$backup_mysql_socket" \
MYSQL_CONFIG_FILE="$backup_mysql_config" \
BACKUP_DIR="$backup_dir" \
  "${backup_command[@]}"

mv -- "$staging_dir" "$final_dir"
trap - EXIT

old_target=""
if [[ -L "$current_link" ]]; then
  old_target="$(readlink -f "$current_link" || true)"
  case "$old_target" in
    "${releases_dir}/"*)
      ;;
    *)
      fail "current 未指向 PaiResume releases 目录"
      ;;
  esac
elif [[ -e "$current_link" ]]; then
  fail "current 已存在且不是软链接"
fi

switch_to_release() {
  local target_name="$1"
  RELEASES_DIR="$releases_dir" \
  RELEASE_NAME="$target_name" \
  CURRENT_LINK="$current_link" \
  PREFLIGHT_SCRIPT="$preflight_script" \
  RUN_PREFLIGHT=false \
    "$switch_script"
}

wait_until_ready() {
  local deadline=$((SECONDS + 150))
  while (( SECONDS < deadline )); do
    if systemctl is-active --quiet "$service_name" \
      && curl --fail --silent --show-error --max-time 5 \
        "http://127.0.0.1:8084/api/health" >/dev/null \
      && curl --fail --silent --show-error --max-time 10 \
        "http://127.0.0.1:8084/api/ready" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

restore_old_release() {
  echo "候选版本未通过，开始恢复上一版本" >&2
  systemctl stop "$service_name" || true
  if [[ -n "$old_target" ]]; then
    old_name="$(basename "$old_target")"
    switch_to_release "$old_name"
    systemctl reset-failed "$service_name" || true
    systemctl start "$service_name"
    if ! wait_until_ready; then
      echo "严重：上一版本恢复后仍未就绪，请立即人工检查 ${service_name}" >&2
      return 1
    fi
  else
    if [[ -L "$current_link" ]]; then
      unlink "$current_link"
    fi
  fi
  failed_target="${failed_dir}/${release_name}-$(date -u +%Y%m%dT%H%M%SZ)"
  if [[ -d "$final_dir" && ! -e "$failed_target" ]]; then
    mv -- "$final_dir" "$failed_target"
  fi
  echo "代码和静态资源已恢复；数据库迁移不会自动回退" >&2
}

switch_to_release "$release_name"
systemctl reset-failed "$service_name" || true
if ! systemctl restart "$service_name" || ! wait_until_ready; then
  restore_old_release
  exit 1
fi

if ! APP_PUBLIC_URL="${APP_PUBLIC_URL:?生产环境缺少 APP_PUBLIC_URL}" "$smoke_script"; then
  restore_old_release
  exit 1
fi

if ! enable_pairesume_units; then
  fail "应用已通过公网 smoke，但启用 PaiResume service/timers 失败；未触碰其他项目的 unit"
fi

if [[ -n "$old_target" ]]; then
  old_name="$(basename "$old_target")"
  RELEASES_DIR="$releases_dir" \
  RELEASE_NAME="$old_name" \
  CURRENT_LINK="$previous_link" \
  PREFLIGHT_SCRIPT="$preflight_script" \
  RUN_PREFLIGHT=false \
    "$switch_script"
fi

echo "PaiResume 发布成功：${release_name}"
echo "当前版本：$(readlink -f "$current_link")"
