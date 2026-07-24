#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")" && pwd -P)"
deploy_config="${PAIRESUME_DEPLOY_CONFIG:-${repo_root}/.deploy.local}"

if [[ -f "$deploy_config" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$deploy_config"
  set +a
fi

usage() {
  cat <<'EOF'
用法：
  ./launch.sh build [--working-tree] [--fetch] [commit-or-tag]
  ./launch.sh deploy [--working-tree] [--fetch] [commit-or-tag]
  ./launch.sh status
  ./launch.sh rollback
  ./launch.sh bootstrap-check

默认拒绝脏工作树。只有显式传入 --working-tree 才会构建当前候选；
release 会记录 base commit、git diff SHA-256、未跟踪文件清单和整包 SHA-256。
--fetch 只在本地更新 origin 引用，生产机永远不执行 git、npm 或 Maven。
EOF
}

command_name="${1:-}"
if [[ -z "$command_name" ]]; then
  usage
  exit 1
fi
shift

deploy_root="${DEPLOY_ROOT:-/home/www/pairesume}"
deploy_port="${DEPLOY_PORT:-22}"
known_hosts_file="${DEPLOY_KNOWN_HOSTS_FILE:-${HOME}/.ssh/known_hosts}"

validate_remote_config() {
  : "${DEPLOY_HOST:?请在 .deploy.local 中设置 DEPLOY_HOST}"
  : "${DEPLOY_USER:?请在 .deploy.local 中设置 DEPLOY_USER}"
  : "${DEPLOY_SSH_KEY:?请在 .deploy.local 中设置 DEPLOY_SSH_KEY}"

  if [[ "$deploy_root" != "/home/www/pairesume" ]]; then
    echo "DEPLOY_ROOT 必须固定为 /home/www/pairesume" >&2
    exit 1
  fi
  if [[ ! "$DEPLOY_HOST" =~ ^[A-Za-z0-9._-]+$ ]]; then
    echo "DEPLOY_HOST 格式不合法" >&2
    exit 1
  fi
  if [[ ! "$DEPLOY_USER" =~ ^[A-Za-z_][A-Za-z0-9._-]*$ ]]; then
    echo "DEPLOY_USER 格式不合法" >&2
    exit 1
  fi
  if [[ ! "$deploy_port" =~ ^[0-9]+$ || "$deploy_port" -lt 1 || "$deploy_port" -gt 65535 ]]; then
    echo "DEPLOY_PORT 必须是有效端口" >&2
    exit 1
  fi
  if [[ "$DEPLOY_SSH_KEY" != /* || ! -f "$DEPLOY_SSH_KEY" || ! -r "$DEPLOY_SSH_KEY" ]]; then
    echo "DEPLOY_SSH_KEY 必须是可读取的绝对文件路径" >&2
    exit 1
  fi
  if [[ ! -f "$known_hosts_file" ]]; then
    echo "known_hosts 不存在，拒绝自动信任生产主机：${known_hosts_file}" >&2
    exit 1
  fi

  local key_mode
  if key_mode="$(stat -f '%Lp' "$DEPLOY_SSH_KEY" 2>/dev/null)"; then
    :
  elif key_mode="$(stat -c '%a' "$DEPLOY_SSH_KEY" 2>/dev/null)"; then
    :
  else
    echo "无法读取 SSH 私钥权限" >&2
    exit 1
  fi
  if (( (8#${key_mode} & 077) != 0 )); then
    echo "SSH 私钥权限过宽，请先设置为 600：${DEPLOY_SSH_KEY}" >&2
    exit 1
  fi
}

ssh_options=()
scp_options=()
prepare_ssh_options() {
  ssh_options=(
    -i "$DEPLOY_SSH_KEY"
    -p "$deploy_port"
    -o BatchMode=yes
    -o IdentitiesOnly=yes
    -o StrictHostKeyChecking=yes
    -o "UserKnownHostsFile=${known_hosts_file}"
    -o ConnectTimeout=10
  )
  scp_options=(
    -i "$DEPLOY_SSH_KEY"
    -P "$deploy_port"
    -o BatchMode=yes
    -o IdentitiesOnly=yes
    -o StrictHostKeyChecking=yes
    -o "UserKnownHostsFile=${known_hosts_file}"
    -o ConnectTimeout=10
  )
}

remote_endpoint() {
  printf '%s@%s' "$DEPLOY_USER" "$DEPLOY_HOST"
}

remote_exec() {
  local remote_command="$1"
  ssh "${ssh_options[@]}" "$(remote_endpoint)" "$remote_command"
}

remote_root_command() {
  local remote_script="$1"
  if [[ "$DEPLOY_USER" == "root" ]]; then
    remote_exec "$remote_script"
  else
    remote_exec "sudo -n ${remote_script}"
  fi
}

parse_build_args() {
  working_tree=false
  fetch_origin=false
  source_ref="HEAD"
  source_ref_set=false
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --working-tree)
        working_tree=true
        shift
        ;;
      --fetch)
        fetch_origin=true
        shift
        ;;
      -*)
        echo "未知参数：$1" >&2
        exit 1
        ;;
      *)
        if [[ "$source_ref_set" == "true" ]]; then
          echo "只能指定一个 commit 或 tag" >&2
          exit 1
        fi
        source_ref="$1"
        source_ref_set=true
        shift
        ;;
    esac
  done
  if [[ "$working_tree" == "true" && "$source_ref" != "HEAD" ]]; then
    echo "--working-tree 不能同时指定其他 commit 或 tag" >&2
    exit 1
  fi
  if [[ "$working_tree" == "true" && "$fetch_origin" == "true" ]]; then
    echo "--working-tree 不需要 --fetch；请先确认当前工作区基线" >&2
    exit 1
  fi
}

run_build() {
  local output_dir="$1"
  local target_platform="$2"
  local build_args=(
    --source-dir "$repo_root"
    --output-dir "$output_dir"
    --ref "$source_ref"
    --target-platform "$target_platform"
  )
  if [[ "$working_tree" == "true" ]]; then
    build_args+=(--working-tree)
  fi
  "${repo_root}/scripts/build-release.sh" "${build_args[@]}"
}

run_remote_predeploy_check() {
  echo "执行生产主机只读发布前置检查"
  remote_root_command "'${deploy_root}/bin/activate-release.sh' --precheck"
}

file_size_bytes() {
  local path="$1"
  if stat -f '%z' "$path" >/dev/null 2>&1; then
    stat -f '%z' "$path"
  else
    stat -c '%s' "$path"
  fi
}

check_remote_disk_for_archive() {
  local archive_path="$1"
  local archive_bytes
  archive_bytes="$(file_size_bytes "$archive_path")"
  if [[ ! "$archive_bytes" =~ ^[0-9]+$ || "$archive_bytes" -lt 1 ]]; then
    echo "无法读取 release 文件大小：${archive_path}" >&2
    exit 1
  fi
  remote_root_command \
    "'${deploy_root}/bin/activate-release.sh' --check-disk '${archive_bytes}'"
}

case "$command_name" in
  build)
    parse_build_args "$@"
    if [[ "$fetch_origin" == "true" ]]; then
      git -C "$repo_root" fetch --prune origin
    fi
    target_platform="${DEPLOY_TARGET_PLATFORM:-linux/amd64}"
    output_dir="${DEPLOY_BUILD_OUTPUT_DIR:-${repo_root}/build/releases}"
    run_build "$output_dir" "$target_platform"
    ;;

  deploy)
    parse_build_args "$@"
    validate_remote_config
    prepare_ssh_options
    run_remote_predeploy_check
    if [[ "$fetch_origin" == "true" ]]; then
      git -C "$repo_root" fetch --prune origin
    fi

    remote_arch="$(remote_exec "uname -m")"
    case "$remote_arch" in
      x86_64)
        target_platform="linux/amd64"
        ;;
      aarch64|arm64)
        target_platform="linux/arm64"
        ;;
      *)
        echo "不支持的生产机架构：${remote_arch}" >&2
        exit 1
        ;;
    esac

    temp_output="$(mktemp -d "${TMPDIR:-/tmp}/pairesume-deploy.XXXXXX")"
    cleanup_deploy() {
      rm -rf -- "$temp_output"
    }
    trap cleanup_deploy EXIT

    run_build "$temp_output" "$target_platform"
    result_file="${temp_output}/release-result.env"
    [[ -f "$result_file" ]] || {
      echo "构建结果文件不存在" >&2
      exit 1
    }
    # 该文件由本地 build-release.sh 生成，字段均经过严格格式校验。
    # shellcheck disable=SC1090
    source "$result_file"
    if [[ ! "${RELEASE_NAME:-}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ \
      || "${ARCHIVE_BASENAME:-}" != "pairesume-${RELEASE_NAME}.tar.gz" \
      || "${CHECKSUM_BASENAME:-}" != "${ARCHIVE_BASENAME}.sha256" ]]; then
      echo "构建结果字段不合法" >&2
      exit 1
    fi

    archive_path="${temp_output}/${ARCHIVE_BASENAME}"
    checksum_path="${temp_output}/${CHECKSUM_BASENAME}"
    [[ -f "$archive_path" && -f "$checksum_path" ]] || {
      echo "release 或 checksum 不存在" >&2
      exit 1
    }
    check_remote_disk_for_archive "$archive_path"

    remote_archive="${deploy_root}/incoming/${ARCHIVE_BASENAME}"
    remote_checksum="${deploy_root}/incoming/${CHECKSUM_BASENAME}"
    endpoint="$(remote_endpoint)"
    remote_exec "test ! -e '${remote_archive}' \
      && test ! -e '${remote_checksum}' \
      && test ! -e '${remote_archive}.partial' \
      && test ! -e '${remote_checksum}.partial'"
    echo "上传 release：${ARCHIVE_BASENAME}"
    scp "${scp_options[@]}" "$archive_path" "${endpoint}:${remote_archive}.partial"
    scp "${scp_options[@]}" "$checksum_path" "${endpoint}:${remote_checksum}.partial"
    remote_exec "test ! -e '${remote_archive}' \
      && test ! -e '${remote_checksum}' \
      && mv -- '${remote_archive}.partial' '${remote_archive}' \
      && mv -- '${remote_checksum}.partial' '${remote_checksum}'"

    remote_root_command \
      "'${deploy_root}/bin/activate-release.sh' '${remote_archive}' '${remote_checksum}'"
    echo "一键发布完成：${RELEASE_NAME}"
    ;;

  status)
    validate_remote_config
    prepare_ssh_options
    remote_exec "echo 'service:' \
      && systemctl is-active pai-resume.service \
      && echo 'current:' \
      && readlink -f '${deploy_root}/current' \
      && echo 'health:' \
      && curl --fail --silent --show-error --max-time 5 \
        http://127.0.0.1:8084/api/health \
      && echo \
      && echo 'ready:' \
      && curl --fail --silent --show-error --max-time 10 \
        http://127.0.0.1:8084/api/ready \
      && echo"
    ;;

  rollback)
    validate_remote_config
    prepare_ssh_options
    remote_root_command "'${deploy_root}/bin/rollback-release.sh'"
    ;;

  bootstrap-check)
    validate_remote_config
    prepare_ssh_options
    run_remote_predeploy_check
    ;;

  -h|--help|help)
    usage
    ;;

  *)
    echo "未知命令：${command_name}" >&2
    usage >&2
    exit 1
    ;;
esac
