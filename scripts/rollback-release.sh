#!/usr/bin/env bash
set -euo pipefail

deploy_root="/home/www/pairesume"
releases_dir="${deploy_root}/releases"
current_link="${deploy_root}/current"
previous_link="${deploy_root}/previous"
lock_file="${deploy_root}/deploy.lock"
bin_dir="${deploy_root}/bin"
env_file="/etc/pai-resume/pai-resume.env"
service_name="pai-resume.service"

fail() {
  echo "回滚失败：$*" >&2
  exit 1
}

if [[ "$EUID" -ne 0 ]]; then
  fail "远端回滚脚本必须由 root 执行"
fi
for command_name in curl flock readlink systemctl; do
  command -v "$command_name" >/dev/null 2>&1 || fail "生产主机缺少命令：${command_name}"
done
[[ -d "$releases_dir" ]] || fail "releases 目录不存在"
[[ -r "$env_file" ]] || fail "生产环境文件不可读"
[[ -L "$current_link" ]] || fail "current 不是软链接"
[[ -L "$previous_link" ]] || fail "没有可回滚的 previous 版本"

exec 9>"$lock_file"
chmod 0600 "$lock_file"
if ! flock -n 9; then
  fail "已有 PaiResume 发布或回滚正在执行"
fi

current_target="$(readlink -f "$current_link")"
previous_target="$(readlink -f "$previous_link")"
case "$current_target" in
  "${releases_dir}/"*)
    ;;
  *)
    fail "current 未指向 PaiResume releases 目录"
    ;;
esac
case "$previous_target" in
  "${releases_dir}/"*)
    ;;
  *)
    fail "previous 未指向 PaiResume releases 目录"
    ;;
esac
[[ "$current_target" != "$previous_target" ]] || fail "current 与 previous 指向同一版本"
[[ -d "$current_target" && -d "$previous_target" ]] || fail "回滚版本目录不存在"

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

preflight_script="${bin_dir}/production-preflight.sh"
switch_script="${bin_dir}/switch-release.sh"
smoke_script="${bin_dir}/smoke-production.sh"
for stable_script in "$preflight_script" "$switch_script" "$smoke_script"; do
  [[ -x "$stable_script" ]] || fail "稳定控制脚本不可执行：${stable_script}"
done

RELEASE_ROOT="$previous_target" "$preflight_script"

switch_link() {
  local target_name="$1"
  local link_path="$2"
  RELEASES_DIR="$releases_dir" \
  RELEASE_NAME="$target_name" \
  CURRENT_LINK="$link_path" \
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

current_name="$(basename "$current_target")"
previous_name="$(basename "$previous_target")"

switch_link "$previous_name" "$current_link"
systemctl reset-failed "$service_name" || true
if systemctl restart "$service_name" \
  && wait_until_ready \
  && APP_PUBLIC_URL="${APP_PUBLIC_URL:?生产环境缺少 APP_PUBLIC_URL}" "$smoke_script"; then
  switch_link "$current_name" "$previous_link"
  echo "PaiResume 已回滚到：${previous_name}"
  echo "可重新切回版本：${current_name}"
  exit 0
fi

echo "回滚候选未通过，恢复回滚前版本：${current_name}" >&2
systemctl stop "$service_name" || true
switch_link "$current_name" "$current_link"
systemctl reset-failed "$service_name" || true
systemctl start "$service_name"
if ! wait_until_ready; then
  echo "严重：恢复回滚前版本后服务仍未就绪，请立即人工检查" >&2
fi
exit 1
