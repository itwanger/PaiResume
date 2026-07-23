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
  VERIFICATION_CODE_SECRET MYSQL_HOST MYSQL_DATABASE MYSQL_USERNAME MYSQL_PASSWORD \
  FLYWAY_USERNAME FLYWAY_PASSWORD REDIS_HOST REDIS_PASSWORD MAIL_HOST MAIL_USERNAME \
  MAIL_PASSWORD MAIL_FROM AI_API_KEY AI_BASE_URL AI_MODEL VITE_SUPPORT_EMAIL \
  VITE_OPERATOR_NAME VITE_AI_PROVIDER_NAME VITE_AI_PROVIDER_PRIVACY_URL \
  FORWARD_HEADERS_STRATEGY APP_PROJECT_ROOT FIELD_OPTIMIZE_PROMPTS_FILE PAYMENT_PROVIDER \
  MEMBERSHIP_ORDER_EXPIRE_MINUTES MEMBERSHIP_PAYMENT_DAYS \
  PAICONGMING_WECHAT_LOGIN_ENABLED PAICONGMING_WECHAT_GATEWAY_BASE_URL \
  PAICONGMING_WECHAT_GATEWAY_QR_PATH PAICONGMING_WECHAT_BRIDGE_SECRET \
  PAICONGMING_WECHAT_APP_ID PAICONGMING_WECHAT_SCENE_PREFIX \
  RESUME_REVIEW_RECIPIENT_EMAIL RESUME_REVIEW_MESSAGE_ID_DOMAIN \
  RESUME_REVIEW_FOLLOW_OFFICIAL_ACCOUNT_NAME RESUME_REVIEW_FOLLOW_QR_CODE_URL \
  RESUME_REVIEW_FOLLOW_BRIDGE_ENABLED RESUME_REVIEW_PAID_ACCEPT_NEW_ORDERS \
  RESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED; do
  require_value "$name"
done

for name in JWT_SECRET VERIFICATION_CODE_SECRET MYSQL_PASSWORD FLYWAY_PASSWORD \
  REDIS_PASSWORD MAIL_USERNAME MAIL_PASSWORD MAIL_FROM AI_API_KEY VITE_SUPPORT_EMAIL \
  VITE_OPERATOR_NAME VITE_AI_PROVIDER_NAME VITE_AI_PROVIDER_PRIVACY_URL \
  PAICONGMING_WECHAT_GATEWAY_BASE_URL PAICONGMING_WECHAT_BRIDGE_SECRET \
  PAICONGMING_WECHAT_APP_ID RESUME_REVIEW_RECIPIENT_EMAIL \
  RESUME_REVIEW_FOLLOW_QR_CODE_URL; do
  reject_placeholder "$name"
done

if [[ "${APP_ENV:-}" != "production" ]]; then
  echo "APP_ENV 必须为 production" >&2
  failures=$((failures + 1))
fi

if [[ "${MEMBERSHIP_ORDER_EXPIRE_MINUTES:-}" != "30" ]]; then
  echo "MEMBERSHIP_ORDER_EXPIRE_MINUTES 必须为 30" >&2
  failures=$((failures + 1))
fi
if [[ "${MEMBERSHIP_PAYMENT_DAYS:-}" != "365" ]]; then
  echo "生产年费会员要求 MEMBERSHIP_PAYMENT_DAYS=365" >&2
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
require_true RESUME_REVIEW_FOLLOW_BRIDGE_ENABLED
require_boolean RESUME_REVIEW_PAID_ACCEPT_NEW_ORDERS
require_boolean RESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED

paicongming_bridge_secret="${PAICONGMING_WECHAT_BRIDGE_SECRET:-}"
review_follow_secret="${RESUME_REVIEW_FOLLOW_BRIDGE_HMAC_SECRET:-}"
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

if [[ ! "${RESUME_REVIEW_RECIPIENT_EMAIL:-}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "RESUME_REVIEW_RECIPIENT_EMAIL 必须是真实、固定且已验证的私密收件箱" >&2
  failures=$((failures + 1))
fi
if [[ ! "${RESUME_REVIEW_MESSAGE_ID_DOMAIN:-}" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
  echo "RESUME_REVIEW_MESSAGE_ID_DOMAIN 必须是可用于 Message-ID 的真实域名" >&2
  failures=$((failures + 1))
fi
if [[ "${RESUME_REVIEW_FOLLOW_OFFICIAL_ACCOUNT_NAME:-}" != "沉默王二" ]]; then
  echo "第二次免费机会必须由独立的“沉默王二”公众号验证，不能与派聪明登录混用" >&2
  failures=$((failures + 1))
fi
if [[ ! "${RESUME_REVIEW_FOLLOW_QR_CODE_URL:-}" =~ ^https://[^[:space:]]+$ ]]; then
  echo "RESUME_REVIEW_FOLLOW_QR_CODE_URL 必须是沉默王二公众号二维码的公网 HTTPS 地址" >&2
  failures=$((failures + 1))
fi
if [[ "${RESUME_REVIEW_FOLLOW_BRIDGE_ENABLED:-false}" == "true" ]]; then
  require_value RESUME_REVIEW_FOLLOW_BRIDGE_HMAC_SECRET
  reject_placeholder RESUME_REVIEW_FOLLOW_BRIDGE_HMAC_SECRET
  if [[ ${#review_follow_secret} -lt 32 ]]; then
    echo "RESUME_REVIEW_FOLLOW_BRIDGE_HMAC_SECRET 不得少于 32 个字符" >&2
    failures=$((failures + 1))
  fi
  if [[ "$review_follow_secret" == "$jwt_secret" \
    || "$review_follow_secret" == "$verification_secret" \
    || "$review_follow_secret" == "$paicongming_bridge_secret" ]]; then
    echo "沉默王二关注桥密钥必须与其他应用密钥相互独立" >&2
    failures=$((failures + 1))
  fi
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
case "$deploy_stage" in
  free)
    require_false PAYMENT_ACCEPT_NEW_ORDERS
    require_false MEMBERSHIP_PAYMENT_ACCEPT_NEW_ORDERS
    require_false MARKETPLACE_PAYMENT_ACCEPT_NEW_ORDERS
    require_false MARKETPLACE_ENABLED
    require_false RESUME_REVIEW_PAID_ACCEPT_NEW_ORDERS
    require_false RESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED
    if [[ "${PAYMENT_PROVIDER:-}" != "disabled" ]]; then
      echo "免费或邀请灰度阶段要求 PAYMENT_PROVIDER=disabled" >&2
      failures=$((failures + 1))
    fi
    ;;
  membership-acceptance)
    require_false PAYMENT_ACCEPT_NEW_ORDERS
    require_boolean MEMBERSHIP_PAYMENT_ACCEPT_NEW_ORDERS
    require_false MARKETPLACE_PAYMENT_ACCEPT_NEW_ORDERS
    require_false MARKETPLACE_ENABLED
    require_boolean RESUME_REVIEW_PAID_ACCEPT_NEW_ORDERS
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
    require_boolean RESUME_REVIEW_PAID_ACCEPT_NEW_ORDERS
    require_true MEMBERSHIP_PAYMENT_ACCEPTANCE_CONFIRMED
    if [[ "${RESUME_REVIEW_PAID_ACCEPT_NEW_ORDERS:-false}" == "true" ]]; then
      require_true RESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED
    fi
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
    require_boolean RESUME_REVIEW_PAID_ACCEPT_NEW_ORDERS
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
    require_boolean RESUME_REVIEW_PAID_ACCEPT_NEW_ORDERS
    require_true MEMBERSHIP_PAYMENT_ACCEPTANCE_CONFIRMED
    require_true MARKETPLACE_PAYMENT_ACCEPTANCE_CONFIRMED
    require_true MARKETPLACE_GOVERNANCE_DUTY_CONFIRMED
    if [[ "${RESUME_REVIEW_PAID_ACCEPT_NEW_ORDERS:-false}" == "true" ]]; then
      require_true RESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED
    fi
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

release_root="${RELEASE_ROOT:-${APP_PROJECT_ROOT:-}}"
if [[ -z "$release_root" || "$release_root" != /* ]]; then
  echo "RELEASE_ROOT（默认 APP_PROJECT_ROOT）必须是待发布目录的绝对路径" >&2
  failures=$((failures + 1))
elif [[ ! -d "$release_root" ]]; then
  echo "待发布目录不存在：${release_root}" >&2
  failures=$((failures + 1))
else
  if [[ ! -f "$release_root/dist/index.html" \
    || ! -f "$release_root/server/pai-resume-server.jar" \
    || ! -f "$release_root/scripts/export-resume-pdf.ts" \
    || ! -f "$release_root/src/utils/resumePdf.tsx" \
    || ! -x "$release_root/node_modules/.bin/tsx" \
    || ! -d "$release_root/public/fonts" \
    || ! -f "$release_root/config/field-optimize-prompts.yml" ]]; then
    echo "待发布目录缺少前后端构建产物、PDF 导出运行时、字体或字段优化配置：${release_root}" >&2
    failures=$((failures + 1))
  else
    for name in VITE_SUPPORT_EMAIL VITE_OPERATOR_NAME VITE_AI_PROVIDER_NAME VITE_AI_PROVIDER_PRIVACY_URL; do
      require_dist_value "$name" "$release_root/dist"
    done
  fi
fi

for name in MYSQL_USE_SSL MYSQL_REQUIRE_SSL MYSQL_VERIFY_SERVER_CERTIFICATE \
  MAIL_TEST_CONNECTION MAIL_STARTTLS_ENABLE MAIL_STARTTLS_REQUIRED; do
  if [[ "${!name:-false}" != "true" ]]; then
    echo "生产环境 ${name} 必须为 true" >&2
    failures=$((failures + 1))
  fi
done

if [[ "${MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL:-true}" != "false" ]]; then
  echo "MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL 必须为 false" >&2
  failures=$((failures + 1))
fi

if [[ "${MYSQL_USERNAME:-root}" == "root" || "${MYSQL_USERNAME:-}" == "${FLYWAY_USERNAME:-}" ]]; then
  echo "MySQL 应用账号必须非 root，且与 Flyway 迁移账号分离" >&2
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
