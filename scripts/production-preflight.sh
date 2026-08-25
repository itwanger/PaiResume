#!/usr/bin/env bash
set -euo pipefail

failures=0

require_value() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "缺少环境变量：${name}" >&2
    failures=$((failures + 1))
  fi
}

require_false() {
  local name="$1"
  if [[ "${!name:-false}" != "false" ]]; then
    echo "当前发布阶段要求 ${name}=false" >&2
    failures=$((failures + 1))
  fi
}

require_true() {
  local name="$1"
  if [[ "${!name:-false}" != "true" ]]; then
    echo "当前发布阶段要求 ${name}=true" >&2
    failures=$((failures + 1))
  fi
}

require_boolean() {
  local name="$1"
  local value="${!name:-false}"
  if [[ "$value" != "true" && "$value" != "false" ]]; then
    echo "${name} 必须为 true 或 false" >&2
    failures=$((failures + 1))
  fi
}

reject_placeholder() {
  local name="$1"
  local value="${!name:-}"
  if [[ "$value" == *replace-me* \
    || "$value" == *replace-with-* \
    || "$value" == your_* \
    || "$value" == *"@example.com" \
    || "$value" == *example.invalid* \
    || "$value" == *待填写* \
    || "$value" == *示例* ]]; then
    echo "${name} 仍是示例占位值" >&2
    failures=$((failures + 1))
  fi
}

require_dist_value() {
  local name="$1"
  local dist_dir="$2"
  local value="${!name:-}"
  if [[ -n "$value" ]] && ! grep -rFq -- "$value" "$dist_dir"; then
    echo "待发布 dist 未编入 ${name} 的当前值；请在加载生产环境变量后重新构建前端" >&2
    failures=$((failures + 1))
  fi
}

for name in DEPLOY_STAGE APP_ENV APP_PUBLIC_URL APP_CORS_ALLOWED_ORIGIN_PATTERNS JWT_SECRET \
  VERIFICATION_CODE_SECRET SERVER_ADDRESS SERVER_PORT \
  MYSQL_HOST MYSQL_PORT MYSQL_DATABASE MYSQL_USERNAME MYSQL_PASSWORD \
  FLYWAY_USERNAME FLYWAY_PASSWORD MYSQL_SHARED_ACCOUNT_CONFIRMED \
  PAIRESUME_BACKUP_MYSQL_USERNAME PAIRESUME_BACKUP_MYSQL_SOCKET \
  REDIS_HOST REDIS_PASSWORD REDIS_DATABASE REDIS_KEY_PREFIX \
  MAIL_HOST MAIL_PORT MAIL_USERNAME MAIL_SSL_ENABLE \
  MAIL_PASSWORD MAIL_FROM AI_API_KEY AI_BASE_URL AI_MODEL AI_ANALYSIS_MODEL VITE_SUPPORT_EMAIL \
  VITE_OPERATOR_NAME VITE_AI_PROVIDER_NAME VITE_AI_PROVIDER_PRIVACY_URL \
  FORWARD_HEADERS_STRATEGY RELEASE_ROOT FIELD_OPTIMIZE_PROMPTS_FILE PAYMENT_PROVIDER \
  SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE \
  SERVER_TOMCAT_THREADS_MAX SERVER_TOMCAT_THREADS_MIN_SPARE \
  SERVER_TOMCAT_MAX_CONNECTIONS SERVER_TOMCAT_ACCEPT_COUNT \
  MEMBERSHIP_ORDER_EXPIRE_MINUTES \
  PAICONGMING_WECHAT_LOGIN_ENABLED \
  PLANET_CORE_ACCEPTANCE_CONFIRMED \
  RESUME_PHOTO_OSS_STAGING_PREFIX RESUME_PHOTO_OSS_OBJECT_PREFIX \
  RESUME_PHOTO_OSS_UPLOAD_URL_TTL_MINUTES RESUME_PHOTO_OSS_ACCESS_URL_TTL_MINUTES \
  RESUME_PHOTO_OSS_MAX_BYTES RESUME_PHOTO_OSS_MAX_DIMENSION RESUME_PHOTO_OSS_MAX_PIXELS \
  RESUME_PHOTO_UPLOAD_RATE_LIMIT_WINDOW_SECONDS \
  RESUME_PHOTO_UPLOAD_RATE_LIMIT_ACCOUNT_ATTEMPTS \
  RESUME_PHOTO_UPLOAD_RATE_LIMIT_IP_ATTEMPTS \
  RESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED; do
  require_value "$name"
done

for name in JWT_SECRET VERIFICATION_CODE_SECRET MYSQL_USERNAME MYSQL_PASSWORD \
  FLYWAY_USERNAME FLYWAY_PASSWORD \
  REDIS_PASSWORD MAIL_USERNAME MAIL_PASSWORD MAIL_FROM AI_API_KEY VITE_SUPPORT_EMAIL \
  VITE_OPERATOR_NAME VITE_AI_PROVIDER_NAME VITE_AI_PROVIDER_PRIVACY_URL; do
  reject_placeholder "$name"
done

require_boolean RESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED
for name in RESUME_REVIEW_MESSAGE_ID_DOMAIN \
    RESUME_REVIEW_MAIL_OUTBOX_MAX_ATTEMPTS \
    RESUME_REVIEW_UPLOAD_RATE_LIMIT_WINDOW_SECONDS \
    RESUME_REVIEW_UPLOAD_RATE_LIMIT_ACCOUNT_ATTEMPTS \
    RESUME_REVIEW_UPLOAD_RATE_LIMIT_IP_ATTEMPTS; do
    require_value "$name"
done

if [[ "${APP_ENV:-}" != "production" ]]; then
  echo "APP_ENV 必须为 production" >&2
  failures=$((failures + 1))
fi

if [[ "${SERVER_ADDRESS:-}" != "127.0.0.1" ]]; then
  echo "SERVER_ADDRESS 必须固定为 127.0.0.1，只允许本机 Nginx 反代访问" >&2
  failures=$((failures + 1))
fi
if [[ "${SERVER_PORT:-}" != "8084" ]]; then
  echo "SERVER_PORT 必须固定为 8084，与 Nginx、健康检查和回滚脚本保持一致" >&2
  failures=$((failures + 1))
fi

if [[ "${MEMBERSHIP_ORDER_EXPIRE_MINUTES:-}" != "30" ]]; then
  echo "MEMBERSHIP_ORDER_EXPIRE_MINUTES 必须为 30" >&2
  failures=$((failures + 1))
fi
if [[ ! "${APP_PUBLIC_URL:-}" =~ ^https://[^/]+/?$ ]]; then
  echo "APP_PUBLIC_URL 必须是无路径的 HTTPS 地址" >&2
  failures=$((failures + 1))
fi

if [[ ! "${APP_CORS_ALLOWED_ORIGIN_PATTERNS:-}" =~ ^https://[^*,[:space:]]+$ ]]; then
  echo "APP_CORS_ALLOWED_ORIGIN_PATTERNS 必须是单个明确的 HTTPS 来源，不能包含通配符" >&2
  failures=$((failures + 1))
fi

if [[ ! "${VITE_SUPPORT_EMAIL:-}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "VITE_SUPPORT_EMAIL 必须是可用的客服邮箱" >&2
  failures=$((failures + 1))
fi

operator_name="${VITE_OPERATOR_NAME:-}"
ai_provider_name="${VITE_AI_PROVIDER_NAME:-}"
if [[ ${#operator_name} -lt 2 ]]; then
  echo "VITE_OPERATOR_NAME 必须填写真实运营主体或个人信息处理者名称" >&2
  failures=$((failures + 1))
fi
if [[ "$operator_name" == "派简历" \
  || "$operator_name" =~ ^[Pp][Aa][Ii][[:space:]_-]?[Rr][Ee][Ss][Uu][Mm][Ee]$ ]]; then
  echo "VITE_OPERATOR_NAME 不能只填写产品名，必须填写真实运营主体" >&2
  failures=$((failures + 1))
fi

if [[ ${#ai_provider_name} -lt 2 ]]; then
  echo "VITE_AI_PROVIDER_NAME 必须填写当前实际使用的第三方 AI 服务商名称" >&2
  failures=$((failures + 1))
fi

if [[ ! "${VITE_AI_PROVIDER_PRIVACY_URL:-}" =~ ^https://[^[:space:]]+$ ]]; then
  echo "VITE_AI_PROVIDER_PRIVACY_URL 必须是第三方 AI 服务商真实的 HTTPS 隐私政策地址" >&2
  failures=$((failures + 1))
fi

jwt_secret="${JWT_SECRET:-}"
verification_secret="${VERIFICATION_CODE_SECRET:-}"
if [[ ${#jwt_secret} -lt 32 || ${#verification_secret} -lt 32 ]]; then
  echo "JWT_SECRET 与 VERIFICATION_CODE_SECRET 均不得少于 32 个字符" >&2
  failures=$((failures + 1))
fi
if [[ -n "$jwt_secret" && "$jwt_secret" == "$verification_secret" ]]; then
  echo "JWT_SECRET 与 VERIFICATION_CODE_SECRET 必须不同" >&2
  failures=$((failures + 1))
fi

require_true PAICONGMING_WECHAT_LOGIN_ENABLED
require_true PLANET_CORE_ACCEPTANCE_CONFIRMED
require_true MYSQL_SHARED_ACCOUNT_CONFIRMED
require_true RESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED

mysql_username="${MYSQL_USERNAME:-}"
flyway_username="${FLYWAY_USERNAME:-}"
mysql_password="${MYSQL_PASSWORD:-}"
flyway_password="${FLYWAY_PASSWORD:-}"
if [[ "$mysql_username" != "pai_resume" || "$flyway_username" != "pai_resume" ]]; then
  echo "MYSQL_USERNAME 与 FLYWAY_USERNAME 必须都固定为 pai_resume" >&2
  failures=$((failures + 1))
fi
if [[ ${#mysql_password} -lt 16 || ${#flyway_password} -lt 16 \
  || "$mysql_password" == "123456" || "$flyway_password" == "123456" ]]; then
  echo "MYSQL_PASSWORD 与 FLYWAY_PASSWORD 均必须使用至少 16 个字符的非默认强密码" >&2
  failures=$((failures + 1))
fi
if [[ -n "$mysql_password" && -n "$flyway_password" \
  && "$mysql_password" != "$flyway_password" ]]; then
  echo "MYSQL_PASSWORD 与 FLYWAY_PASSWORD 必须完全相同，生产只维护一个 pai_resume 账号" >&2
  failures=$((failures + 1))
fi
if [[ "${MYSQL_HOST:-}" != "127.0.0.1" ]]; then
  echo "MYSQL_HOST 必须固定为 127.0.0.1，禁止应用绕到公网 MySQL" >&2
  failures=$((failures + 1))
fi
if [[ "${MYSQL_PORT:-}" != "3306" ]]; then
  echo "MYSQL_PORT 必须固定为 3306，与本机备份所连接的 MySQL 实例保持一致" >&2
  failures=$((failures + 1))
fi
if [[ "${MYSQL_DATABASE:-}" != "pai_resume" ]]; then
  echo "MYSQL_DATABASE 必须固定为 pai_resume，与发布前备份目标保持一致" >&2
  failures=$((failures + 1))
fi
if [[ "${PAIRESUME_BACKUP_MYSQL_USERNAME:-}" != "root" ]]; then
  echo "生产备份固定要求 PAIRESUME_BACKUP_MYSQL_USERNAME=root" >&2
  failures=$((failures + 1))
fi
if [[ "${PAIRESUME_BACKUP_MYSQL_SOCKET:-}" != /* ]]; then
  echo "PAIRESUME_BACKUP_MYSQL_SOCKET 必须是绝对路径" >&2
  failures=$((failures + 1))
fi

paicongming_bridge_secret="${PAICONGMING_WECHAT_BRIDGE_SECRET:-}"
if [[ "${PAICONGMING_WECHAT_LOGIN_ENABLED:-false}" == "true" ]]; then
  for name in PAICONGMING_WECHAT_GATEWAY_BASE_URL PAICONGMING_WECHAT_GATEWAY_QR_PATH \
    PAICONGMING_WECHAT_BRIDGE_SECRET PAICONGMING_WECHAT_APP_ID \
    PAICONGMING_WECHAT_SCENE_PREFIX; do
    require_value "$name"
  done
  for name in PAICONGMING_WECHAT_GATEWAY_BASE_URL PAICONGMING_WECHAT_BRIDGE_SECRET \
    PAICONGMING_WECHAT_APP_ID; do
    reject_placeholder "$name"
  done

  if [[ ! "${PAICONGMING_WECHAT_GATEWAY_BASE_URL:-}" =~ ^https://[^/]+/?$ ]]; then
    echo "PAICONGMING_WECHAT_GATEWAY_BASE_URL 必须是明确的公网 HTTPS 根地址" >&2
    failures=$((failures + 1))
  fi
  if [[ ! "${PAICONGMING_WECHAT_GATEWAY_QR_PATH:-}" =~ ^/[A-Za-z0-9_./-]+$ \
    || "${PAICONGMING_WECHAT_GATEWAY_QR_PATH:-}" == //* ]]; then
    echo "PAICONGMING_WECHAT_GATEWAY_QR_PATH 必须是站内绝对路径" >&2
    failures=$((failures + 1))
  fi
  if [[ ! "${PAICONGMING_WECHAT_APP_ID:-}" =~ ^wx[A-Za-z0-9]{16}$ ]]; then
    echo "PAICONGMING_WECHAT_APP_ID 必须是派聪明服务号的真实 AppID" >&2
    failures=$((failures + 1))
  fi
  if [[ ! "${PAICONGMING_WECHAT_SCENE_PREFIX:-}" =~ ^[A-Za-z0-9_-]{2,16}$ ]]; then
    echo "PAICONGMING_WECHAT_SCENE_PREFIX 只能包含 2 至 16 位字母、数字、下划线或连字符" >&2
    failures=$((failures + 1))
  fi
  if [[ ${#paicongming_bridge_secret} -lt 32 ]]; then
    echo "PAICONGMING_WECHAT_BRIDGE_SECRET 不得少于 32 个字符" >&2
    failures=$((failures + 1))
  fi
  if [[ "$paicongming_bridge_secret" == "$jwt_secret" \
    || "$paicongming_bridge_secret" == "$verification_secret" ]]; then
    echo "派聪明桥接密钥必须与 JWT/验证码密钥相互独立" >&2
    failures=$((failures + 1))
  fi
fi

validate_integer_range() {
  local name="$1"
  local minimum="$2"
  local maximum="$3"
  local value="${!name:-}"
  if [[ ! "$value" =~ ^[0-9]+$ ]] || (( value < minimum || value > maximum )); then
    echo "${name} 必须是 ${minimum} 到 ${maximum} 之间的整数" >&2
    failures=$((failures + 1))
  fi
}

photo_staging_prefix="${RESUME_PHOTO_OSS_STAGING_PREFIX:-}"
photo_object_prefix="${RESUME_PHOTO_OSS_OBJECT_PREFIX:-}"
for entry in "staging:${photo_staging_prefix}" "objects:${photo_object_prefix}"; do
  prefix_name="${entry%%:*}"
  prefix_value="${entry#*:}"
  if [[ ! "$prefix_value" =~ ^[A-Za-z0-9/_-]+/$ \
    || "$prefix_value" == /* || "$prefix_value" == *//* ]]; then
    echo "照片 OSS ${prefix_name} prefix 必须是仅含字母、数字、/、_、-，无双斜杠且以 / 结尾的相对对象前缀" >&2
    failures=$((failures + 1))
  fi
done
if [[ -n "$photo_staging_prefix" && -n "$photo_object_prefix" \
  && ( "$photo_staging_prefix" == "$photo_object_prefix" \
    || "$photo_staging_prefix" == "$photo_object_prefix"* \
    || "$photo_object_prefix" == "$photo_staging_prefix"* ) ]]; then
  echo "照片 OSS staging 与固化对象前缀必须互不相同且不能互相包含" >&2
  failures=$((failures + 1))
fi

validate_integer_range RESUME_PHOTO_OSS_UPLOAD_URL_TTL_MINUTES 1 30
validate_integer_range RESUME_PHOTO_OSS_ACCESS_URL_TTL_MINUTES 5 360
validate_integer_range RESUME_PHOTO_OSS_MAX_BYTES 1024 3145728
validate_integer_range RESUME_PHOTO_OSS_MAX_DIMENSION 256 4096
validate_integer_range RESUME_PHOTO_OSS_MAX_PIXELS 65536 16000000
validate_integer_range RESUME_PHOTO_UPLOAD_RATE_LIMIT_WINDOW_SECONDS 60 3600
validate_integer_range RESUME_PHOTO_UPLOAD_RATE_LIMIT_ACCOUNT_ATTEMPTS 1 100
validate_integer_range RESUME_PHOTO_UPLOAD_RATE_LIMIT_IP_ATTEMPTS 1 2000

photo_upload_account_attempts="${RESUME_PHOTO_UPLOAD_RATE_LIMIT_ACCOUNT_ATTEMPTS:-}"
photo_upload_ip_attempts="${RESUME_PHOTO_UPLOAD_RATE_LIMIT_IP_ATTEMPTS:-}"
if [[ "$photo_upload_account_attempts" =~ ^[0-9]+$ \
  && "$photo_upload_ip_attempts" =~ ^[0-9]+$ ]] \
  && (( 10#$photo_upload_ip_attempts < 10#$photo_upload_account_attempts )); then
  echo "RESUME_PHOTO_UPLOAD_RATE_LIMIT_IP_ATTEMPTS 不得小于账号预算" >&2
  failures=$((failures + 1))
fi

review_recipient_email="${RESUME_REVIEW_RECIPIENT_EMAIL:-${MAIL_FROM:-${MAIL_USERNAME:-}}}"
if [[ ! "$review_recipient_email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "人工精修收件邮箱必须有效；未设置 RESUME_REVIEW_RECIPIENT_EMAIL 时复用 MAIL_FROM" >&2
  failures=$((failures + 1))
fi
if [[ ! "${RESUME_REVIEW_MESSAGE_ID_DOMAIN:-}" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
  echo "RESUME_REVIEW_MESSAGE_ID_DOMAIN 必须是可用于 Message-ID 的真实域名" >&2
  failures=$((failures + 1))
fi
validate_integer_range RESUME_REVIEW_MAIL_OUTBOX_MAX_ATTEMPTS 1 50
validate_integer_range RESUME_REVIEW_UPLOAD_RATE_LIMIT_WINDOW_SECONDS 60 3600
validate_integer_range RESUME_REVIEW_UPLOAD_RATE_LIMIT_ACCOUNT_ATTEMPTS 1 100
validate_integer_range RESUME_REVIEW_UPLOAD_RATE_LIMIT_IP_ATTEMPTS 1 2000

upload_account_attempts="${RESUME_REVIEW_UPLOAD_RATE_LIMIT_ACCOUNT_ATTEMPTS:-}"
upload_ip_attempts="${RESUME_REVIEW_UPLOAD_RATE_LIMIT_IP_ATTEMPTS:-}"
if [[ "$upload_account_attempts" =~ ^[0-9]+$ \
  && "$upload_ip_attempts" =~ ^[0-9]+$ ]] \
  && (( 10#$upload_ip_attempts < 10#$upload_account_attempts )); then
  echo "RESUME_REVIEW_UPLOAD_RATE_LIMIT_IP_ATTEMPTS 不得小于账号预算" >&2
  failures=$((failures + 1))
fi

validate_integer_range SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE 2 20
validate_integer_range SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE 0 10
validate_integer_range SERVER_TOMCAT_THREADS_MAX 8 200
validate_integer_range SERVER_TOMCAT_THREADS_MIN_SPARE 1 32
validate_integer_range SERVER_TOMCAT_MAX_CONNECTIONS 64 2048
validate_integer_range SERVER_TOMCAT_ACCEPT_COUNT 8 512

hikari_maximum_pool_size="${SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE:-}"
hikari_minimum_idle="${SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE:-}"
if [[ "$hikari_maximum_pool_size" =~ ^[0-9]+$ \
  && "$hikari_minimum_idle" =~ ^[0-9]+$ ]] \
  && (( 10#$hikari_minimum_idle > 10#$hikari_maximum_pool_size )); then
  echo "SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE 不得大于 MAXIMUM_POOL_SIZE" >&2
  failures=$((failures + 1))
fi

tomcat_threads_max="${SERVER_TOMCAT_THREADS_MAX:-}"
tomcat_threads_min_spare="${SERVER_TOMCAT_THREADS_MIN_SPARE:-}"
if [[ "$tomcat_threads_max" =~ ^[0-9]+$ \
  && "$tomcat_threads_min_spare" =~ ^[0-9]+$ ]] \
  && (( 10#$tomcat_threads_min_spare > 10#$tomcat_threads_max )); then
  echo "SERVER_TOMCAT_THREADS_MIN_SPARE 不得大于 THREADS_MAX" >&2
  failures=$((failures + 1))
fi

tomcat_max_connections="${SERVER_TOMCAT_MAX_CONNECTIONS:-}"
tomcat_accept_count="${SERVER_TOMCAT_ACCEPT_COUNT:-}"
if [[ "$tomcat_max_connections" =~ ^[0-9]+$ \
  && "$tomcat_accept_count" =~ ^[0-9]+$ ]] \
  && (( 10#$tomcat_accept_count > 10#$tomcat_max_connections )); then
  echo "SERVER_TOMCAT_ACCEPT_COUNT 不得大于 MAX_CONNECTIONS" >&2
  failures=$((failures + 1))
fi

validate_wechat_payment() {
  local name
  for name in WECHAT_PAY_APP_ID WECHAT_PAY_MERCHANT_ID WECHAT_PAY_PRIVATE_KEY \
    WECHAT_PAY_MERCHANT_SERIAL_NUMBER WECHAT_PAY_API_V3_KEY WECHAT_PAY_NOTIFY_URL; do
    require_value "$name"
    reject_placeholder "$name"
  done

  local api_v3_key="${WECHAT_PAY_API_V3_KEY:-}"
  if [[ ${#api_v3_key} -ne 32 ]]; then
    echo "WECHAT_PAY_API_V3_KEY 必须恰好为 32 个字符" >&2
    failures=$((failures + 1))
  fi

  local expected_notify_url="${APP_PUBLIC_URL%/}/api/public/payments/wechat/notify"
  if [[ "${WECHAT_PAY_NOTIFY_URL:-}" != "$expected_notify_url" ]]; then
    echo "WECHAT_PAY_NOTIFY_URL 必须精确等于 ${expected_notify_url}" >&2
    failures=$((failures + 1))
  fi
}

deploy_stage="${DEPLOY_STAGE:-}"
if [[ "${PAYMENT_PROVIDER:-}" != "wechat-native" ]]; then
  echo "人工精修是常驻付费服务，PAYMENT_PROVIDER 必须为 wechat-native" >&2
  failures=$((failures + 1))
else
  validate_wechat_payment
fi
case "$deploy_stage" in
  free)
    require_false PAYMENT_ACCEPT_NEW_ORDERS
    require_false MEMBERSHIP_PAYMENT_ACCEPT_NEW_ORDERS
    require_false MARKETPLACE_PAYMENT_ACCEPT_NEW_ORDERS
    require_false MARKETPLACE_ENABLED
    ;;
  membership-acceptance)
    require_false PAYMENT_ACCEPT_NEW_ORDERS
    require_boolean MEMBERSHIP_PAYMENT_ACCEPT_NEW_ORDERS
    require_false MARKETPLACE_PAYMENT_ACCEPT_NEW_ORDERS
    require_false MARKETPLACE_ENABLED
    require_true PAYMENT_ACCEPTANCE_ENVIRONMENT_CONFIRMED
    if [[ "${PAYMENT_PROVIDER:-}" != "wechat-native" ]]; then
      echo "会员支付验收模式要求 PAYMENT_PROVIDER=wechat-native" >&2
      failures=$((failures + 1))
    fi
    validate_wechat_payment
    ;;
  membership)
    require_false PAYMENT_ACCEPT_NEW_ORDERS
    require_boolean MEMBERSHIP_PAYMENT_ACCEPT_NEW_ORDERS
    require_false MARKETPLACE_PAYMENT_ACCEPT_NEW_ORDERS
    require_false MARKETPLACE_ENABLED
    require_true MEMBERSHIP_PAYMENT_ACCEPTANCE_CONFIRMED
    if [[ "${PAYMENT_PROVIDER:-}" != "wechat-native" ]]; then
      echo "会员支付阶段要求 PAYMENT_PROVIDER=wechat-native" >&2
      failures=$((failures + 1))
    fi
    validate_wechat_payment
    ;;
  marketplace-acceptance)
    require_false PAYMENT_ACCEPT_NEW_ORDERS
    require_boolean MEMBERSHIP_PAYMENT_ACCEPT_NEW_ORDERS
    require_boolean MARKETPLACE_PAYMENT_ACCEPT_NEW_ORDERS
    require_true MARKETPLACE_ENABLED
    require_true MEMBERSHIP_PAYMENT_ACCEPTANCE_CONFIRMED
    require_true MARKETPLACE_GOVERNANCE_DUTY_CONFIRMED
    require_true PAYMENT_ACCEPTANCE_ENVIRONMENT_CONFIRMED
    if [[ "${PAYMENT_PROVIDER:-}" != "wechat-native" ]]; then
      echo "用户简历市场验收模式要求 PAYMENT_PROVIDER=wechat-native" >&2
      failures=$((failures + 1))
    fi
    validate_wechat_payment
    ;;
  marketplace)
    require_false PAYMENT_ACCEPT_NEW_ORDERS
    require_boolean MEMBERSHIP_PAYMENT_ACCEPT_NEW_ORDERS
    require_boolean MARKETPLACE_PAYMENT_ACCEPT_NEW_ORDERS
    require_boolean MARKETPLACE_ENABLED
    require_true MEMBERSHIP_PAYMENT_ACCEPTANCE_CONFIRMED
    require_true MARKETPLACE_PAYMENT_ACCEPTANCE_CONFIRMED
    require_true MARKETPLACE_GOVERNANCE_DUTY_CONFIRMED
    if [[ "${PAYMENT_PROVIDER:-}" != "wechat-native" ]]; then
      echo "用户简历市场阶段要求 PAYMENT_PROVIDER=wechat-native" >&2
      failures=$((failures + 1))
    fi
    if [[ "${MARKETPLACE_PAYMENT_ACCEPT_NEW_ORDERS:-false}" == "true" \
      && "${MARKETPLACE_ENABLED:-false}" != "true" ]]; then
      echo "开启市场新订单时必须同时设置 MARKETPLACE_ENABLED=true" >&2
      failures=$((failures + 1))
    fi
    validate_wechat_payment
    ;;
  *)
    echo "DEPLOY_STAGE 必须显式设置为 free、membership-acceptance、membership、marketplace-acceptance 或 marketplace" >&2
    failures=$((failures + 1))
    ;;
esac

if [[ "${FORWARD_HEADERS_STRATEGY:-}" != "native" ]]; then
  echo "FORWARD_HEADERS_STRATEGY 必须为 native" >&2
  failures=$((failures + 1))
fi

release_root="${RELEASE_ROOT:-}"
if [[ -z "$release_root" || "$release_root" != /* ]]; then
  echo "RELEASE_ROOT 必须是待发布目录的绝对路径" >&2
  failures=$((failures + 1))
elif [[ ! -d "$release_root" ]]; then
  echo "待发布目录不存在：${release_root}" >&2
  failures=$((failures + 1))
else
  if [[ ! -f "$release_root/dist/index.html" \
    || ! -f "$release_root/server/pai-resume-server.jar" \
    || ! -f "$release_root/config/field-optimize-prompts.yml" \
    || ! -f "$release_root/manifest/SHA256SUMS" \
    || ! -f "$release_root/manifest/release-name" \
    || ! -f "$release_root/manifest/base-commit" \
    || ! -f "$release_root/manifest/source-mode" \
    || ! -f "$release_root/manifest/git-diff-sha256" \
    || ! -f "$release_root/manifest/untracked-files-sha256" \
    || ! -f "$release_root/manifest/untracked-file-count" \
    || ! -f "$release_root/manifest/untracked-files.txt" \
    || ! -f "$release_root/manifest/target-uname" \
    || ! -f "$release_root/manifest/target-platform" \
    || ! -f "$release_root/manifest/artifact-architecture" \
    || ! -f "$release_root/manifest/java-class-major" \
    || ! -f "$release_root/manifest/artifact-contract" ]]; then
    echo "待发布目录缺少前后端构建产物、字段优化配置或 release manifest：${release_root}" >&2
    failures=$((failures + 1))
  else
    for name in APP_PUBLIC_URL VITE_SUPPORT_EMAIL VITE_OPERATOR_NAME VITE_AI_PROVIDER_NAME \
      VITE_AI_PROVIDER_PRIVACY_URL; do
      require_dist_value "$name" "$release_root/dist"
    done

    release_name="$(tr -d '\r\n' < "$release_root/manifest/release-name")"
    base_commit="$(tr -d '\r\n' < "$release_root/manifest/base-commit")"
    source_mode="$(tr -d '\r\n' < "$release_root/manifest/source-mode")"
    diff_sha="$(tr -d '\r\n' < "$release_root/manifest/git-diff-sha256")"
    untracked_sha="$(tr -d '\r\n' < "$release_root/manifest/untracked-files-sha256")"
    untracked_count="$(tr -d '\r\n' < "$release_root/manifest/untracked-file-count")"
    expected_arch="$(tr -d '\r\n' < "$release_root/manifest/target-uname")"
    target_platform="$(tr -d '\r\n' < "$release_root/manifest/target-platform")"
    artifact_architecture="$(tr -d '\r\n' < "$release_root/manifest/artifact-architecture")"
    java_class_major="$(tr -d '\r\n' < "$release_root/manifest/java-class-major")"
    artifact_contract="$(tr -d '\r\n' < "$release_root/manifest/artifact-contract")"

    if [[ ! "$release_name" =~ ^[A-Za-z0-9._-]+$ ]]; then
      echo "release manifest 中的版本名不合法" >&2
      failures=$((failures + 1))
    fi
    if [[ ! "$base_commit" =~ ^[0-9a-f]{40}$ ]]; then
      echo "release manifest 中的 base commit 不合法" >&2
      failures=$((failures + 1))
    fi
    if [[ "$source_mode" != "commit" && "$source_mode" != "working-tree" ]]; then
      echo "release manifest 中的 source mode 必须是 commit 或 working-tree" >&2
      failures=$((failures + 1))
    fi
    if [[ ! "$diff_sha" =~ ^[0-9a-f]{64}$ ]]; then
      echo "release manifest 中的 git diff SHA-256 不合法" >&2
      failures=$((failures + 1))
    fi
    if [[ ! "$untracked_sha" =~ ^[0-9a-f]{64}$ ]]; then
      echo "release manifest 中的未跟踪文件清单 SHA-256 不合法" >&2
      failures=$((failures + 1))
    fi
    actual_untracked_count="$(wc -l < "$release_root/manifest/untracked-files.txt" | tr -d '[:space:]')"
    if [[ ! "$untracked_count" =~ ^[0-9]+$ || "$untracked_count" != "$actual_untracked_count" ]]; then
      echo "release manifest 中的未跟踪文件数量与清单不一致" >&2
      failures=$((failures + 1))
    fi
    if [[ "$expected_arch" != "$(uname -m)" ]]; then
      echo "release 目标架构 ${expected_arch:-unknown} 与当前主机 $(uname -m) 不一致" >&2
      failures=$((failures + 1))
    fi
    case "${target_platform}:${expected_arch}" in
      linux/amd64:x86_64|linux/arm64:aarch64)
        ;;
      *)
        echo "release target platform 与 uname 映射不合法" >&2
        failures=$((failures + 1))
        ;;
    esac
    if [[ "$artifact_architecture" != "neutral" \
      || "$java_class_major" != "61" \
      || "$artifact_contract" != "dist+java17-jar+config-v2" ]]; then
      echo "release 制品合同不匹配：必须是架构中立 dist + Java 17 JAR + config v2" >&2
      failures=$((failures + 1))
    fi

    if ! command -v sha256sum >/dev/null 2>&1; then
      echo "生产主机缺少 sha256sum，无法验证 release 完整性" >&2
      failures=$((failures + 1))
    else
      actual_untracked_sha="$(sha256sum "$release_root/manifest/untracked-files.txt" | awk '{print $1}')"
      if [[ "$untracked_sha" != "$actual_untracked_sha" ]]; then
        echo "release manifest 中的未跟踪文件清单 SHA-256 不匹配" >&2
        failures=$((failures + 1))
      fi
      if ! (
        cd "$release_root"
        sha256sum --quiet --check manifest/SHA256SUMS
      ); then
        echo "release 文件 SHA-256 校验失败" >&2
        failures=$((failures + 1))
      fi
    fi
  fi
fi

for name in MYSQL_USE_SSL MYSQL_REQUIRE_SSL MYSQL_VERIFY_SERVER_CERTIFICATE \
  MAIL_TEST_CONNECTION; do
  if [[ "${!name:-false}" != "true" ]]; then
    echo "生产环境 ${name} 必须为 true" >&2
    failures=$((failures + 1))
  fi
done

case "${MAIL_PORT:-}" in
  465)
    if [[ "${MAIL_SSL_ENABLE:-false}" != "true" \
      || "${MAIL_STARTTLS_ENABLE:-true}" != "false" \
      || "${MAIL_STARTTLS_REQUIRED:-true}" != "false" ]]; then
      echo "MAIL_PORT=465 必须使用 SSL=true 且 STARTTLS=false" >&2
      failures=$((failures + 1))
    fi
    ;;
  587)
    if [[ "${MAIL_SSL_ENABLE:-true}" != "false" \
      || "${MAIL_STARTTLS_ENABLE:-false}" != "true" \
      || "${MAIL_STARTTLS_REQUIRED:-false}" != "true" ]]; then
      echo "MAIL_PORT=587 必须使用 SSL=false 且 STARTTLS=true/required=true" >&2
      failures=$((failures + 1))
    fi
    ;;
  *)
    echo "生产 SMTP 仅允许 MAIL_PORT=465（隐式 TLS）或 587（STARTTLS）" >&2
    failures=$((failures + 1))
    ;;
esac

if [[ "${MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL:-true}" != "false" ]]; then
  echo "MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL 必须为 false" >&2
  failures=$((failures + 1))
fi

if [[ "${REDIS_DATABASE:-}" != "1" ]]; then
  echo "当前生产部署决策要求 REDIS_DATABASE=1，避免写入其他项目正在使用的 DB 0" >&2
  failures=$((failures + 1))
fi
if [[ "${REDIS_KEY_PREFIX:-}" != "pairesume:prod:" ]]; then
  echo "当前生产部署决策要求 REDIS_KEY_PREFIX=pairesume:prod:" >&2
  failures=$((failures + 1))
fi

if [[ "${REFRESH_COOKIE_SECURE:-false}" != "true" ]]; then
  echo "REFRESH_COOKIE_SECURE 必须为 true" >&2
  failures=$((failures + 1))
fi

if [[ "${SPRINGDOC_ENABLED:-true}" != "false" ]]; then
  echo "SPRINGDOC_ENABLED 必须为 false" >&2
  failures=$((failures + 1))
fi

if [[ "$failures" -ne 0 ]]; then
  echo "生产预检失败：${failures} 项" >&2
  exit 1
fi

echo "生产环境变量与待发布产物预检通过；当前阶段：${deploy_stage}。"
