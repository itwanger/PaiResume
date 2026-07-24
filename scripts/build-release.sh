#!/usr/bin/env bash
set -euo pipefail
umask 022

script_dir="$(cd "$(dirname "$0")" && pwd -P)"
default_source_dir="$(cd "${script_dir}/.." && pwd -P)"

source_dir="$default_source_dir"
output_dir=""
source_ref="HEAD"
release_name=""
target_platform="linux/amd64"
working_tree=false
build_offline="${BUILD_OFFLINE:-false}"

usage() {
  cat <<'EOF'
用法：
  scripts/build-release.sh --output-dir DIR [--ref COMMIT_OR_TAG]
                           [--release-name NAME]
                           [--target-platform linux/amd64|linux/arm64]
                           [--working-tree]

默认拒绝脏工作树。只有显式传入 --working-tree 才会构建当前工作区，
并在 release manifest 中记录 base commit、完整 git diff SHA-256 和未跟踪文件清单。
EOF
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --source-dir)
      source_dir="${2:?--source-dir 缺少参数}"
      shift 2
      ;;
    --output-dir)
      output_dir="${2:?--output-dir 缺少参数}"
      shift 2
      ;;
    --ref)
      source_ref="${2:?--ref 缺少参数}"
      shift 2
      ;;
    --release-name)
      release_name="${2:?--release-name 缺少参数}"
      shift 2
      ;;
    --target-platform)
      target_platform="${2:?--target-platform 缺少参数}"
      shift 2
      ;;
    --working-tree)
      working_tree=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数：$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$output_dir" ]]; then
  echo "必须设置 --output-dir" >&2
  exit 1
fi
if [[ "$build_offline" != "true" && "$build_offline" != "false" ]]; then
  echo "BUILD_OFFLINE 只能是 true 或 false" >&2
  exit 1
fi

source_dir="$(cd "$source_dir" && pwd -P)"
if ! git -C "$source_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "SOURCE_DIR 不是 Git 工作区：${source_dir}" >&2
  exit 1
fi

case "$target_platform" in
  linux/amd64)
    target_uname="x86_64"
    ;;
  linux/arm64)
    target_uname="aarch64"
    ;;
  *)
    echo "仅支持 linux/amd64 或 linux/arm64" >&2
    exit 1
    ;;
esac

for command_name in git java mvn node npm od tar unzip; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "本地缺少命令：${command_name}" >&2
    exit 1
  fi
done

node_version="$(node --version)"
npm_version="$(npm --version)"
maven_version_output="$(mvn --version)"
java_version_output="$(java -version 2>&1)"
if [[ ! "$node_version" =~ ^v22\. ]]; then
  echo "本地构建要求 Node.js 22，实际为 ${node_version}" >&2
  exit 1
fi
if [[ ! "$npm_version" =~ ^10\. ]]; then
  echo "本地构建要求 npm 10，实际为 ${npm_version}" >&2
  exit 1
fi
if [[ ! "$maven_version_output" =~ Apache[[:space:]]Maven[[:space:]]3\.9\. ]]; then
  echo "本地构建要求 Maven 3.9.x" >&2
  exit 1
fi
if [[ ! "$java_version_output" =~ version[[:space:]]\"([0-9]+) ]]; then
  echo "无法识别本地 Java 版本" >&2
  exit 1
fi
java_major="${BASH_REMATCH[1]}"
if (( java_major < 17 )); then
  echo "本地构建要求 JDK 17 或更高版本" >&2
  exit 1
fi

for public_name in VITE_SUPPORT_EMAIL VITE_OPERATOR_NAME VITE_AI_PROVIDER_NAME \
  VITE_AI_PROVIDER_PRIVACY_URL; do
  if [[ -z "${!public_name:-}" ]]; then
    echo "构建前必须设置公开前端变量：${public_name}" >&2
    exit 1
  fi
done
vite_public_url="${VITE_APP_PUBLIC_URL:-${APP_PUBLIC_URL:-}}"
if [[ ! "$vite_public_url" =~ ^https://[^/]+/?$ ]]; then
  echo "VITE_APP_PUBLIC_URL 或 APP_PUBLIC_URL 必须是无路径 HTTPS 根地址" >&2
  exit 1
fi

if [[ "$working_tree" == "false" ]] \
  && [[ -n "$(git -C "$source_dir" status --porcelain --untracked-files=all)" ]]; then
  echo "默认拒绝构建脏工作树；如确需构建当前候选，请显式传入 --working-tree" >&2
  exit 1
fi

if [[ "$working_tree" == "true" && "$source_ref" != "HEAD" ]]; then
  echo "--working-tree 只能以当前 HEAD 为 base，不能同时指定其他 --ref" >&2
  exit 1
fi

if ! base_commit="$(git -C "$source_dir" rev-parse --verify "${source_ref}^{commit}")"; then
  echo "无法解析代码版本：${source_ref}" >&2
  exit 1
fi
if [[ "$working_tree" == "true" ]]; then
  base_commit="$(git -C "$source_dir" rev-parse --verify HEAD)"
  source_mode="working-tree"
else
  source_mode="commit"
fi

short_commit="${base_commit:0:12}"
build_timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
if [[ -z "$release_name" ]]; then
  release_name="${short_commit}-${build_timestamp}"
fi
if [[ ! "$release_name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]]; then
  echo "release name 只能包含字母、数字、点、下划线和连字符" >&2
  exit 1
fi

temp_root="$(mktemp -d "${TMPDIR:-/tmp}/pairesume-build.XXXXXX")"
cleanup() {
  rm -rf -- "$temp_root"
}
trap cleanup EXIT

snapshot_dir="${temp_root}/source"
release_dir="${temp_root}/release"
diff_file="${temp_root}/working-tree.diff"
untracked_file="${temp_root}/untracked-files.txt"
mkdir -p "$snapshot_dir" "$release_dir" "$release_dir/manifest"
: > "$untracked_file"

sha256_file() {
  local path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$path" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$path" | awk '{print $1}'
  else
    echo "缺少 sha256sum 或 shasum" >&2
    return 1
  fi
}

if [[ "$working_tree" == "true" ]]; then
  git -C "$source_dir" diff --binary --full-index HEAD > "$diff_file"
  while IFS= read -r -d '' relative_path; do
    if [[ "$relative_path" == /* || "$relative_path" == *$'\n'* \
      || "$relative_path" == ".." || "$relative_path" == ../* \
      || "$relative_path" == */../* ]]; then
      echo "工作树包含不安全路径，拒绝构建" >&2
      exit 1
    fi
    source_path="${source_dir}/${relative_path}"
    if [[ -f "$source_path" || -L "$source_path" ]]; then
      mkdir -p "${snapshot_dir}/$(dirname "$relative_path")"
      cp -pP -- "$source_path" "${snapshot_dir}/${relative_path}"
    fi
  done < <(git -C "$source_dir" ls-files --cached --others --exclude-standard -z)

  while IFS= read -r -d '' relative_path; do
    if [[ "$relative_path" == *$'\n'* ]]; then
      echo "未跟踪文件名包含换行，拒绝构建" >&2
      exit 1
    fi
    printf '%s\n' "$relative_path" >> "$untracked_file"
  done < <(git -C "$source_dir" ls-files --others --exclude-standard -z)
else
  : > "$diff_file"
  git -C "$source_dir" archive --format=tar "$base_commit" | tar -xf - -C "$snapshot_dir"
fi

git_diff_sha256="$(sha256_file "$diff_file")"
untracked_sha256="$(sha256_file "$untracked_file")"
untracked_count="$(wc -l < "$untracked_file" | tr -d '[:space:]')"

echo "使用本机构建架构中立制品：Node ${node_version} / npm ${npm_version} / JDK ${java_major}"
echo "构建前端：${release_name}"
(
  cd "$snapshot_dir"
  export VITE_APP_PUBLIC_URL="$vite_public_url"
  export VITE_SUPPORT_EMAIL VITE_OPERATOR_NAME VITE_AI_PROVIDER_NAME VITE_AI_PROVIDER_PRIVACY_URL
  npm_ci_args=(ci --no-audit --no-fund)
  if [[ "$build_offline" == "true" ]]; then
    npm_ci_args+=(--offline)
  fi
  npm "${npm_ci_args[@]}"
  npm run lint
  npm run build
)
mkdir -p "$release_dir/dist" "$release_dir/config"
cp -R "$snapshot_dir/dist/." "$release_dir/dist/"
cp "$snapshot_dir/config/field-optimize-prompts.yml" \
  "$release_dir/config/field-optimize-prompts.yml"

echo "构建后端：${release_name}"
(
  cd "$snapshot_dir"
  maven_args=(--batch-mode --no-transfer-progress)
  if [[ "$build_offline" == "true" ]]; then
    maven_args+=(--offline)
  fi
  test_classpath_file="${temp_root}/maven-test-classpath.txt"
  mvn "${maven_args[@]}" -f server/pom.xml dependency:build-classpath \
    -Dmdep.includeScope=test -Dmdep.outputFile="$test_classpath_file"
  byte_buddy_agent=""
  # dependency:build-classpath 默认不保证文件以换行结尾；read 在已读到内容时
  # 仍可能返回 EOF，不能让 set -e 把有效 classpath 当成失败。
  IFS=':' read -r -a test_classpath_entries < "$test_classpath_file" || true
  for classpath_entry in "${test_classpath_entries[@]}"; do
    if [[ "$(basename "$classpath_entry")" == byte-buddy-agent-*.jar ]]; then
      byte_buddy_agent="$classpath_entry"
      break
    fi
  done
  if [[ -z "$byte_buddy_agent" || ! -f "$byte_buddy_agent" ]]; then
    echo "无法解析 Mockito 所需 Byte Buddy Java agent" >&2
    exit 1
  fi
  # package 已包含完整 test 生命周期，避免把同一批测试重复执行两遍。
  # 显式 premain agent，避免 JDK 21/macOS 禁止 Mockito 动态 self-attach。
  mvn "${maven_args[@]}" -f server/pom.xml \
    "-DargLine=-javaagent:${byte_buddy_agent}" package
)
mkdir -p "$release_dir/server"
jar_count="$(find "$snapshot_dir/server/target" -maxdepth 1 -type f \
  -name 'pai-resume-server-*.jar' ! -name '*.original' | wc -l | tr -d '[:space:]')"
if [[ "$jar_count" != "1" ]]; then
  echo "后端 JAR 数量异常：${jar_count}" >&2
  exit 1
fi
jar_path="$(find "$snapshot_dir/server/target" -maxdepth 1 -type f \
  -name 'pai-resume-server-*.jar' ! -name '*.original')"

class_entry="BOOT-INF/classes/com/itwanger/pairesume/PaiResumeApplication.class"
class_file="${temp_root}/PaiResumeApplication.class"
if ! unzip -p "$jar_path" "$class_entry" > "$class_file" || [[ ! -s "$class_file" ]]; then
  echo "无法从 JAR 读取应用入口 class" >&2
  exit 1
fi
read -r class_major_high class_major_low < <(od -An -t u1 -j 6 -N 2 "$class_file")
class_major=$((class_major_high * 256 + class_major_low))
if [[ "$class_major" -ne 61 ]]; then
  echo "后端 class major=${class_major}，预期 Java 17 的 61" >&2
  exit 1
fi
cp "$jar_path" "$release_dir/server/pai-resume-server.jar"

printf '%s\n' "$release_name" > "$release_dir/manifest/release-name"
printf '%s\n' "$base_commit" > "$release_dir/manifest/base-commit"
printf '%s\n' "$source_mode" > "$release_dir/manifest/source-mode"
printf '%s\n' "$source_ref" > "$release_dir/manifest/source-ref"
printf '%s\n' "$git_diff_sha256" > "$release_dir/manifest/git-diff-sha256"
printf '%s\n' "$untracked_sha256" > "$release_dir/manifest/untracked-files-sha256"
printf '%s\n' "$untracked_count" > "$release_dir/manifest/untracked-file-count"
cp "$untracked_file" "$release_dir/manifest/untracked-files.txt"
printf '%s\n' "$target_uname" > "$release_dir/manifest/target-uname"
printf '%s\n' "$target_platform" > "$release_dir/manifest/target-platform"
printf '%s\n' "$build_timestamp" > "$release_dir/manifest/built-at-utc"
printf '%s\n' "neutral" > "$release_dir/manifest/artifact-architecture"
printf '%s\n' "$class_major" > "$release_dir/manifest/java-class-major"
printf '%s\n' "dist+java17-jar+config-v2" > "$release_dir/manifest/artifact-contract"

mkdir -p "$output_dir"
output_dir="$(cd "$output_dir" && pwd -P)"
archive_basename="pairesume-${release_name}.tar.gz"
archive_path="${output_dir}/${archive_basename}"
checksum_path="${archive_path}.sha256"
if [[ -e "$archive_path" || -e "$checksum_path" ]]; then
  echo "输出 release 已存在，拒绝覆盖：${archive_path}" >&2
  exit 1
fi

if find "$release_dir" -type l -print -quit | grep -q .; then
  echo "release 中不允许包含软链接" >&2
  exit 1
fi
if find "$release_dir" \( -name '.DS_Store' -o -name '._*' \) -print -quit | grep -q .; then
  echo "release 中不允许包含 macOS 元数据文件" >&2
  exit 1
fi
while IFS= read -r -d '' release_file; do
  if [[ "$release_file" == *$'\n'* ]]; then
    echo "release 文件名不允许包含换行" >&2
    exit 1
  fi
done < <(find "$release_dir" -type f -print0)

(
  cd "$release_dir"
  : > manifest/SHA256SUMS
  while IFS= read -r release_file; do
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum "$release_file" >> manifest/SHA256SUMS
    else
      shasum -a 256 "$release_file" >> manifest/SHA256SUMS
    fi
  done < <(find . -type f ! -path './manifest/SHA256SUMS' | LC_ALL=C sort)
)

COPYFILE_DISABLE=1 tar -czf "$archive_path" -C "$release_dir" .
if tar -tzf "$archive_path" | grep -Eq '(^|/)(\._[^/]*|\.DS_Store)$'; then
  echo "archive 包含 macOS AppleDouble/xattr 元数据" >&2
  exit 1
fi
archive_checksum="$(sha256_file "$archive_path")"
printf '%s  %s\n' "$archive_checksum" "$archive_basename" > "$checksum_path"

{
  printf 'RELEASE_NAME=%s\n' "$release_name"
  printf 'ARCHIVE_BASENAME=%s\n' "$archive_basename"
  printf 'CHECKSUM_BASENAME=%s.sha256\n' "$archive_basename"
  printf 'BASE_COMMIT=%s\n' "$base_commit"
  printf 'SOURCE_MODE=%s\n' "$source_mode"
  printf 'GIT_DIFF_SHA256=%s\n' "$git_diff_sha256"
  printf 'UNTRACKED_FILES_SHA256=%s\n' "$untracked_sha256"
} > "${output_dir}/release-result.env"

echo "release 构建完成：${archive_path}"
echo "整包校验文件：${checksum_path}"
