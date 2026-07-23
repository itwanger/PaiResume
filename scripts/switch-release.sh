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
  || ! -f "$target/scripts/export-resume-pdf.ts" \
  || ! -f "$target/src/utils/resumePdf.tsx" \
  || ! -x "$target/node_modules/.bin/tsx" \
  || ! -d "$target/public/fonts" \
  || ! -f "$target/config/field-optimize-prompts.yml" ]]; then
  echo "目标版本缺少前端或后端构建产物：${target}" >&2
  exit 1
fi
if [[ ! -x "$preflight_script" ]]; then
  echo "稳定控制目录缺少可执行预检脚本：${preflight_script}" >&2
  exit 1
fi

RELEASE_ROOT="$target" "$preflight_script"

current_parent="$(dirname "$CURRENT_LINK")"
mkdir -p "$current_parent"
ln -sfn "$target" "$CURRENT_LINK"
echo "当前版本已切换到：${target}"
