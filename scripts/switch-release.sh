#!/usr/bin/env bash
set -euo pipefail

: "${RELEASES_DIR:?必须设置 RELEASES_DIR}"
: "${RELEASE_NAME:?必须设置 RELEASE_NAME}"
: "${CURRENT_LINK:?必须设置 CURRENT_LINK}"

if [[ ! "$RELEASE_NAME" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "RELEASE_NAME 格式不合法" >&2
  exit 1
fi

releases_real="$(cd "$RELEASES_DIR" && pwd -P)"
target="${releases_real}/${RELEASE_NAME}"
script_dir="$(cd "$(dirname "$0")" && pwd -P)"
preflight_script="${PREFLIGHT_SCRIPT:-${script_dir}/production-preflight.sh}"
if [[ ! -d "$target" \
  || ! -f "$target/dist/index.html" \
  || ! -f "$target/server/pai-resume-server.jar" \
  || ! -f "$target/config/field-optimize-prompts.yml" \
  || ! -f "$target/manifest/SHA256SUMS" \
  || ! -f "$target/manifest/release-name" \
  || ! -f "$target/manifest/java-class-major" \
  || ! -f "$target/manifest/artifact-contract" ]]; then
  echo "目标版本缺少前端、后端、配置或 manifest：${target}" >&2
  exit 1
fi
if [[ "$(tr -d '\r\n' < "$target/manifest/java-class-major")" != "61" \
  || "$(tr -d '\r\n' < "$target/manifest/artifact-contract")" \
    != "dist+java17-jar+config-v2" ]]; then
  echo "目标版本不符合 Java 17 架构中立制品合同：${target}" >&2
  exit 1
fi

if [[ "${RUN_PREFLIGHT:-true}" == "true" ]]; then
  if [[ ! -x "$preflight_script" ]]; then
    echo "稳定控制目录缺少可执行预检脚本：${preflight_script}" >&2
    exit 1
  fi
  RELEASE_ROOT="$target" "$preflight_script"
elif [[ "${RUN_PREFLIGHT:-true}" != "false" ]]; then
  echo "RUN_PREFLIGHT 只能是 true 或 false" >&2
  exit 1
fi

current_parent="$(dirname "$CURRENT_LINK")"
mkdir -p "$current_parent"
if [[ -e "$CURRENT_LINK" && ! -L "$CURRENT_LINK" ]]; then
  echo "CURRENT_LINK 已存在且不是软链接，拒绝覆盖：${CURRENT_LINK}" >&2
  exit 1
fi
if ! mv --help 2>&1 | grep -q -- ' -T,'; then
  echo "目标系统 mv 不支持 -T，无法保证 current 原子切换" >&2
  exit 1
fi

link_name="$(basename "$CURRENT_LINK")"
temp_link="${current_parent}/.${link_name}.new.$$"
cleanup() {
  rm -f -- "$temp_link"
}
trap cleanup EXIT

ln -s "$target" "$temp_link"
mv -Tf -- "$temp_link" "$CURRENT_LINK"
trap - EXIT
echo "当前版本已切换到：${target}"
