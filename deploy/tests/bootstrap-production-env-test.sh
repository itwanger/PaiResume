#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd -P)"
script="${repo_root}/deploy/bootstrap-production-env.sh"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/pairesume-bootstrap-test.XXXXXX")"
source_env="${test_root}/paicoding.env"
target_env="${test_root}/etc/pai-resume.env"
db_credentials="${test_root}/mysql-app.env"
db_password='A9!db-password-test-only-0123456789z@'

cleanup() {
  rm -rf -- "$test_root"
}
trap cleanup EXIT HUP INT TERM

mkdir -p "$(dirname "$target_env")"
printf '%s\n' \
  'MYSQL_USERNAME=pai_resume' \
  "MYSQL_PASSWORD=${db_password}" > "$db_credentials"
chmod 0600 "$db_credentials"
export PAIRESUME_BOOTSTRAP_DB_CREDENTIALS_FILE="$db_credentials"
printf '%s\n' \
  'PAICODING_REDIS_HOST=127.0.0.1' \
  'PAICODING_REDIS_PORT=6388' \
  'PAICODING_REDIS_PASSWORD=redis-password-test-only' \
  'PAICODING_MAIL_HOST=smtp.example.test' \
  'PAICODING_MAIL_PORT=465' \
  'PAICODING_MAIL_USERNAME=mailer' \
  'PAICODING_MAIL_USERNAME=mailer' \
  'PAICODING_MAIL_PASSWORD=mail-password-test-only' \
  'PAICODING_MAIL_FROM=support@example.test' \
  'PAICODING_MAIL_ALERM_USER=review@example.test,alarm@example.test' \
  'PAICODING_DEEPSEEK_API_KEY=deepseek-key-test-only' \
  'PAIRESUME_WECHAT_BRIDGE_SECRET=paicongming-bridge-secret-test-only-0123456789' \
  'WX_APP_ID=wx1234567890abcdef' \
  'PAIRESUME_WECHAT_SCENE_PREFIX=pr_' \
  'PAIRESUME_WECHAT_PAY_APP_ID=wx-test-app' \
  'PAIRESUME_WECHAT_PAY_MERCHANT_ID=1900000001' \
  'PAIRESUME_WECHAT_PAY_PRIVATE_KEY=wechat-private-key-test-only' \
  'PAIRESUME_WECHAT_PAY_MERCHANT_SERIAL_NUMBER=wechat-serial-test-only' \
  'PAIRESUME_WECHAT_PAY_API_V3_KEY=0123456789abcdef0123456789abcdef' \
  > "$source_env"
chmod 0600 "$source_env"

export PAIRESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED=true
export PAIRESUME_PLANET_CORE_ACCEPTANCE_CONFIRMED=true

source_checksum_before="$(shasum -a 256 "$source_env" | awk '{print $1}')"
first_output="$(
  SERVER_ADDRESS=0.0.0.0 \
  SERVER_PORT=18084 \
  MYSQL_HOST=database.example.test \
  MYSQL_PORT=13306 \
  MYSQL_DATABASE=wrong_database \
  MYSQL_USERNAME=wrong_user \
  MYSQL_PASSWORD=bootstrap-override-password-secret \
  FLYWAY_USERNAME=wrong_flyway_user \
  FLYWAY_PASSWORD=bootstrap-override-flyway-secret \
  PAIRESUME_SUPPORT_EMAIL=public-support@support.test \
  PAIRESUME_BOOTSTRAP_TEST_MODE=true \
  PAIRESUME_BOOTSTRAP_SOURCE_ENV="$source_env" \
  PAIRESUME_BOOTSTRAP_TARGET_ENV="$target_env" \
    "$script" 2>&1
)"

for secret in \
  "$db_password" \
  redis-password-test-only \
  mail-password-test-only \
  deepseek-key-test-only \
  paicongming-bridge-secret-test-only-0123456789 \
  wechat-private-key-test-only \
  0123456789abcdef0123456789abcdef \
  bootstrap-override-password-secret \
  bootstrap-override-flyway-secret; do
  if [[ "$first_output" == *"$secret"* ]]; then
    printf 'bootstrap 输出泄漏测试秘密\n' >&2
    exit 1
  fi
done

source_checksum_after="$(shasum -a 256 "$source_env" | awk '{print $1}')"
[[ "$source_checksum_before" == "$source_checksum_after" ]] \
  || {
    printf 'bootstrap 修改了源环境文件\n' >&2
    exit 1
  }

conflicting_source_env="${test_root}/paicoding-conflicting.env"
cp "$source_env" "$conflicting_source_env"
printf '%s\n' 'PAICODING_MAIL_USERNAME=other-mailer' >> "$conflicting_source_env"
chmod 0600 "$conflicting_source_env"
conflicting_target_env="${test_root}/conflicting-target.env"
PAIRESUME_BOOTSTRAP_TEST_MODE=true \
PAIRESUME_BOOTSTRAP_SOURCE_ENV="$conflicting_source_env" \
PAIRESUME_BOOTSTRAP_TARGET_ENV="$conflicting_target_env" \
  "$script" >/dev/null 2>&1
grep -Fqx "MAIL_USERNAME='other-mailer'" "$conflicting_target_env" \
  || {
    printf '源环境文件未使用最后一次变量定义\n' >&2
    exit 1
  }

conflicting_db_credentials="${test_root}/mysql-app-conflicting.env"
printf '%s\n' \
  'MYSQL_USERNAME=pai_resume' \
  "MYSQL_PASSWORD=${db_password}" \
  'MYSQL_PASSWORD=other-password-that-is-long-enough-0123456789' \
  > "$conflicting_db_credentials"
chmod 0600 "$conflicting_db_credentials"
if conflicting_output="$(
  PAIRESUME_BOOTSTRAP_TEST_MODE=true \
  PAIRESUME_BOOTSTRAP_SOURCE_ENV="$source_env" \
  PAIRESUME_BOOTSTRAP_TARGET_ENV="${test_root}/conflicting-db-target.env" \
  PAIRESUME_BOOTSTRAP_DB_CREDENTIALS_FILE="$conflicting_db_credentials" \
    "$script" 2>&1
)"; then
  printf '冲突的重复数据库凭据未被拒绝\n' >&2
  exit 1
fi
[[ "$conflicting_output" == *'存在冲突的重复定义'* ]] \
  || {
    printf '冲突的重复数据库凭据拒绝原因不正确\n' >&2
    exit 1
  }

if mode="$(stat -f '%Lp' "$target_env" 2>/dev/null)"; then
  :
else
  mode="$(stat -c '%a' "$target_env")"
fi
[[ "$mode" == "600" ]] \
  || {
    printf '目标环境文件权限不是 600\n' >&2
    exit 1
  }

for expected in \
  "APP_ENV='production'" \
  "DEPLOY_STAGE='free'" \
  "SERVER_ADDRESS='127.0.0.1'" \
  "SERVER_PORT='8084'" \
  "SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE='5'" \
  "SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE='1'" \
  "SERVER_TOMCAT_THREADS_MAX='48'" \
  "SERVER_TOMCAT_THREADS_MIN_SPARE='4'" \
  "SERVER_TOMCAT_MAX_CONNECTIONS='256'" \
  "SERVER_TOMCAT_ACCEPT_COUNT='32'" \
  "VITE_SUPPORT_EMAIL='public-support@support.test'" \
  "MYSQL_HOST='127.0.0.1'" \
  "MYSQL_PORT='3306'" \
  "MYSQL_DATABASE='pai_resume'" \
  "MYSQL_SHARED_ACCOUNT_CONFIRMED='true'" \
  "MYSQL_USERNAME='pai_resume'" \
  "MYSQL_PASSWORD='${db_password}'" \
  "FLYWAY_USERNAME='pai_resume'" \
  "FLYWAY_PASSWORD='${db_password}'" \
  "MYSQL_USE_SSL='true'" \
  "MYSQL_REQUIRE_SSL='true'" \
  "MYSQL_VERIFY_SERVER_CERTIFICATE='true'" \
  "MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL='false'" \
  "PAIRESUME_BACKUP_MYSQL_USERNAME='root'" \
  "PAIRESUME_BACKUP_MYSQL_SOCKET='/var/lib/mysql/mysql.sock'" \
  "REDIS_DATABASE='1'" \
  "REDIS_KEY_PREFIX='pairesume:prod:'" \
  "PAICONGMING_WECHAT_LOGIN_ENABLED='true'" \
  "PAICONGMING_WECHAT_GATEWAY_BASE_URL='https://paicoding.com'" \
  "PAICONGMING_WECHAT_GATEWAY_QR_PATH='/api/internal/pairesume/wechat/qrcodes'" \
  "PAICONGMING_WECHAT_BRIDGE_SECRET='paicongming-bridge-secret-test-only-0123456789'" \
  "PAICONGMING_WECHAT_APP_ID='wx1234567890abcdef'" \
  "PAICONGMING_WECHAT_SCENE_PREFIX='pr_'" \
  "PLANET_CORE_ACCEPTANCE_CONFIRMED='true'" \
  "AI_MODEL='deepseek-v4-flash'" \
  "PAYMENT_PROVIDER='wechat-native'" \
  "PAYMENT_ACCEPT_NEW_ORDERS='false'" \
  "MEMBERSHIP_PAYMENT_ACCEPT_NEW_ORDERS='false'" \
  "MARKETPLACE_PAYMENT_ACCEPT_NEW_ORDERS='false'" \
  "SHOWCASE_PAYMENT_ACCEPT_NEW_ORDERS='false'" \
  "MARKETPLACE_ENABLED='false'" \
  "RESUME_REVIEW_MAIL_OUTBOX_MAX_ATTEMPTS='10'" \
  "RESUME_REVIEW_UPLOAD_RATE_LIMIT_WINDOW_SECONDS='900'" \
  "RESUME_REVIEW_UPLOAD_RATE_LIMIT_ACCOUNT_ATTEMPTS='20'" \
  "RESUME_REVIEW_UPLOAD_RATE_LIMIT_IP_ATTEMPTS='200'" \
  "RESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED='true'" \
  "WECHAT_PAY_APP_ID='wx-test-app'" \
  "WECHAT_PAY_MERCHANT_ID='1900000001'" \
  "WECHAT_PAY_PRIVATE_KEY='wechat-private-key-test-only'" \
  "WECHAT_PAY_MERCHANT_SERIAL_NUMBER='wechat-serial-test-only'" \
  "WECHAT_PAY_API_V3_KEY='0123456789abcdef0123456789abcdef'" \
  "RESUME_PHOTO_OSS_STAGING_PREFIX='pairesume/resume-photo/staging/'" \
  "RESUME_PHOTO_OSS_OBJECT_PREFIX='pairesume/resume-photo/objects/'"; do
  grep -Fqx -- "$expected" "$target_env" \
    || {
      printf '目标环境文件缺少预期的安全配置项\n' >&2
      exit 1
    }
done

preflight_script="${repo_root}/scripts/production-preflight.sh"
preflight_release="${test_root}/release"
preflight_bin="${test_root}/preflight-bin"
mkdir -p \
  "$preflight_release/dist" \
  "$preflight_release/server" \
  "$preflight_release/config" \
  "$preflight_release/manifest" \
  "$preflight_bin"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'printf "%s\n" aarch64' > "$preflight_bin/uname"
chmod 0755 "$preflight_bin/uname"

(
  set -a
  # shellcheck disable=SC1090
  source "$target_env"
  set +a
  printf '%s\n' \
    "$APP_PUBLIC_URL" \
    "$VITE_SUPPORT_EMAIL" \
    "$VITE_OPERATOR_NAME" \
    "$VITE_AI_PROVIDER_NAME" \
    "$VITE_AI_PROVIDER_PRIVACY_URL" \
    > "$preflight_release/dist/index.html"
)
printf '%s\n' 'test jar' > "$preflight_release/server/pai-resume-server.jar"
printf '%s\n' 'prompts: {}' > "$preflight_release/config/field-optimize-prompts.yml"
printf '%s\n' 'test-release' > "$preflight_release/manifest/release-name"
printf '%040d\n' 0 > "$preflight_release/manifest/base-commit"
printf '%s\n' 'commit' > "$preflight_release/manifest/source-mode"
printf '%064d\n' 0 > "$preflight_release/manifest/git-diff-sha256"
: > "$preflight_release/manifest/untracked-files.txt"
untracked_sha="$(
  sha256sum "$preflight_release/manifest/untracked-files.txt" | awk '{print $1}'
)"
printf '%s\n' "$untracked_sha" > "$preflight_release/manifest/untracked-files-sha256"
printf '%s\n' '0' > "$preflight_release/manifest/untracked-file-count"
printf '%s\n' 'aarch64' > "$preflight_release/manifest/target-uname"
printf '%s\n' 'linux/arm64' > "$preflight_release/manifest/target-platform"
printf '%s\n' 'neutral' > "$preflight_release/manifest/artifact-architecture"
printf '%s\n' '61' > "$preflight_release/manifest/java-class-major"
printf '%s\n' 'dist+java17-jar+config-v2' > "$preflight_release/manifest/artifact-contract"
(
  cd "$preflight_release"
  sha256sum \
    dist/index.html \
    server/pai-resume-server.jar \
    config/field-optimize-prompts.yml \
    manifest/release-name \
    manifest/base-commit \
    manifest/source-mode \
    manifest/git-diff-sha256 \
    manifest/untracked-files-sha256 \
    manifest/untracked-file-count \
    manifest/untracked-files.txt \
    manifest/target-uname \
    manifest/target-platform \
    manifest/artifact-architecture \
    manifest/java-class-major \
    manifest/artifact-contract \
    > manifest/SHA256SUMS
)

run_preflight() {
  local override_name="${1:-}"
  local override_value="${2:-}"
  (
    set -a
    # shellcheck disable=SC1090
    source "$target_env"
    set +a
    export RELEASE_ROOT="$preflight_release"
    if [[ -n "$override_name" ]]; then
      export "${override_name}=${override_value}"
    fi
    PATH="${preflight_bin}:${PATH}" "$preflight_script"
  )
}

preflight_output="$(run_preflight 2>&1)" \
  || {
    printf '生成的生产环境未通过生产预检：%s\n' "$preflight_output" >&2
    exit 1
  }
for secret in \
  "$db_password" \
  redis-password-test-only \
  mail-password-test-only \
  deepseek-key-test-only \
  paicongming-bridge-secret-test-only-0123456789 \
  oss-sk-test-only \
  wechat-private-key-test-only \
  0123456789abcdef0123456789abcdef; do
  if [[ "$preflight_output" == *"$secret"* ]]; then
    printf '生产预检输出泄漏测试秘密\n' >&2
    exit 1
  fi
done

assert_preflight_rejects() {
  local override_name="$1"
  local override_value="$2"
  local expected_message="$3"
  local output=""
  if output="$(run_preflight "$override_name" "$override_value" 2>&1)"; then
    printf '生产预检未拒绝不安全配置：%s\n' "$override_name" >&2
    exit 1
  fi
  if [[ "$output" != *"$expected_message"* ]]; then
    printf '生产预检拒绝原因不正确：%s\n' "$override_name" >&2
    exit 1
  fi
  if [[ "$output" == *"$db_password"* || "$output" == *"$override_value"* ]]; then
    printf '生产预检拒绝路径泄漏配置值：%s\n' "$override_name" >&2
    exit 1
  fi
}

assert_preflight_rejects SERVER_ADDRESS 0.0.0.0 \
  'SERVER_ADDRESS 必须固定为 127.0.0.1'
assert_preflight_rejects SERVER_PORT 18084 \
  'SERVER_PORT 必须固定为 8084'
assert_preflight_rejects MYSQL_HOST database.example.test \
  'MYSQL_HOST 必须固定为 127.0.0.1'
assert_preflight_rejects MYSQL_PORT 13306 \
  'MYSQL_PORT 必须固定为 3306'
assert_preflight_rejects MYSQL_DATABASE wrong_database \
  'MYSQL_DATABASE 必须固定为 pai_resume'
assert_preflight_rejects MYSQL_USERNAME wrong_user \
  'MYSQL_USERNAME 与 FLYWAY_USERNAME 必须都固定为 pai_resume'
assert_preflight_rejects FLYWAY_USERNAME wrong_flyway_user \
  'MYSQL_USERNAME 与 FLYWAY_USERNAME 必须都固定为 pai_resume'
assert_preflight_rejects FLYWAY_PASSWORD different-password-test-only-0123456789 \
  'MYSQL_PASSWORD 与 FLYWAY_PASSWORD 必须完全相同'
assert_preflight_rejects RESUME_PHOTO_OSS_MAX_BYTES 3145729 \
  'RESUME_PHOTO_OSS_MAX_BYTES 必须是 1024 到 3145728 之间的整数'
assert_preflight_rejects RESUME_PHOTO_UPLOAD_RATE_LIMIT_IP_ATTEMPTS 10 \
  'RESUME_PHOTO_UPLOAD_RATE_LIMIT_IP_ATTEMPTS 不得小于账号预算'
assert_preflight_rejects PAICONGMING_WECHAT_LOGIN_ENABLED false \
  '当前发布阶段要求 PAICONGMING_WECHAT_LOGIN_ENABLED=true'
assert_preflight_rejects PLANET_CORE_ACCEPTANCE_CONFIRMED false \
  '当前发布阶段要求 PLANET_CORE_ACCEPTANCE_CONFIRMED=true'
for expected in \
  "MAIL_STARTTLS_ENABLE='false'" \
  "MAIL_STARTTLS_REQUIRED='false'" \
  "MAIL_SSL_ENABLE='true'"; do
  grep -Fqx -- "$expected" "$target_env" \
    || {
      printf '465 端口未使用纯隐式 TLS 配置\n' >&2
      exit 1
    }
done

starttls_source_env="${test_root}/paicoding-587.env"
starttls_target_env="${test_root}/etc/pai-resume-587.env"
sed 's/^PAICODING_MAIL_PORT=465$/PAICODING_MAIL_PORT=587/' \
  "$source_env" > "$starttls_source_env"
chmod 0600 "$starttls_source_env"
PAIRESUME_BOOTSTRAP_TEST_MODE=true \
PAIRESUME_BOOTSTRAP_SOURCE_ENV="$starttls_source_env" \
PAIRESUME_BOOTSTRAP_TARGET_ENV="$starttls_target_env" \
  "$script" >/dev/null 2>&1
for expected in \
  "MAIL_STARTTLS_ENABLE='true'" \
  "MAIL_STARTTLS_REQUIRED='true'" \
  "MAIL_SSL_ENABLE='false'"; do
  grep -Fqx -- "$expected" "$starttls_target_env" \
    || {
      printf '587 端口未使用纯 STARTTLS 配置\n' >&2
      exit 1
    }
done

jwt_before="$(grep '^JWT_SECRET=' "$target_env")"
verification_before="$(grep '^VERIFICATION_CODE_SECRET=' "$target_env")"
second_output="$(
  PAIRESUME_BOOTSTRAP_TEST_MODE=true \
  PAIRESUME_BOOTSTRAP_SOURCE_ENV="$source_env" \
  PAIRESUME_BOOTSTRAP_TARGET_ENV="$target_env" \
    "$script" 2>&1
)"
jwt_after="$(grep '^JWT_SECRET=' "$target_env")"
verification_after="$(grep '^VERIFICATION_CODE_SECRET=' "$target_env")"
[[ "$jwt_before" == "$jwt_after" && "$verification_before" == "$verification_after" ]] \
  || {
    printf '重复执行时应用密钥发生了变化\n' >&2
    exit 1
  }
grep -Fqx "VITE_SUPPORT_EMAIL='public-support@support.test'" "$target_env" \
  || {
    printf '重复执行时对外客服邮箱未保留\n' >&2
    exit 1
  }
[[ "$second_output" != *"password-test-only"* \
  && "$second_output" != *"deepseek-key-test-only"* \
  && "$second_output" != *"paicongming-bridge-secret-test-only-0123456789"* ]] \
  || {
    printf '重复执行时输出泄漏测试秘密\n' >&2
    exit 1
  }
xtrace_output="$(
  PAIRESUME_BOOTSTRAP_TEST_MODE=true \
  PAIRESUME_BOOTSTRAP_SOURCE_ENV="$source_env" \
  PAIRESUME_BOOTSTRAP_TARGET_ENV="${test_root}/xtrace-target.env" \
    bash -x "$script" 2>&1
)"
for secret in \
  "$db_password" \
  redis-password-test-only \
  mail-password-test-only \
  deepseek-key-test-only \
  paicongming-bridge-secret-test-only-0123456789 \
  wechat-private-key-test-only \
  0123456789abcdef0123456789abcdef; do
  if [[ "$xtrace_output" == *"$secret"* ]]; then
    printf 'bash -x 输出泄漏测试秘密\n' >&2
    exit 1
  fi
done

dangerous_credentials="${test_root}/dangerous-mysql-app.env"
printf '%s\n' \
  'MYSQL_USERNAME=pai_resume' \
  "MYSQL_PASSWORD=unsafe'value" > "$dangerous_credentials"
chmod 0600 "$dangerous_credentials"
if dangerous_output="$(
  PAIRESUME_BOOTSTRAP_TEST_MODE=true \
  PAIRESUME_BOOTSTRAP_SOURCE_ENV="$source_env" \
  PAIRESUME_BOOTSTRAP_TARGET_ENV="${test_root}/dangerous-target.env" \
  PAIRESUME_BOOTSTRAP_DB_CREDENTIALS_FILE="$dangerous_credentials" \
    "$script" 2>&1
)"; then
  printf '危险环境变量值未被拒绝\n' >&2
  exit 1
fi
[[ "$dangerous_output" != *"unsafe'value"* ]] \
  || {
    printf '危险值被输出\n' >&2
    exit 1
  }

printf '%s\n' 'bootstrap-production-env tests passed'
