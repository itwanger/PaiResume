#!/usr/bin/env bash
set -euo pipefail
# Refuse caller-provided xtrace so secret-bearing assignments are never traced
# by this script even if it is invoked with "bash -x".
set +x

# Bootstrap /etc/pai-resume/pai-resume.env from the existing paicoding
# production environment without evaluating either file as shell code.
#
# Production usage (as root):
#   ./deploy/bootstrap-production-env.sh
#
# The PAIRESUME_BOOTSTRAP_* path overrides are intentionally available only
# in test mode so an operator cannot accidentally target another production
# file. Confirmation overrides are booleans, never secrets.

umask 077
export LC_ALL=C

readonly production_source_env="/home/www/paicoding/.env"
readonly production_target_env="/etc/pai-resume/pai-resume.env"
readonly production_db_credentials="/etc/pai-resume/mysql-app.env"
readonly production_server_address="127.0.0.1"
readonly production_server_port="8084"
readonly production_mysql_host="127.0.0.1"
readonly production_mysql_port="3306"
readonly production_mysql_database="pai_resume"
readonly production_mysql_username="pai_resume"

die() {
  printf '%s\n' "$1" >&2
  exit 1
}

if [[ "${PAIRESUME_BOOTSTRAP_TEST_MODE:-false}" == "true" ]]; then
  source_env="${PAIRESUME_BOOTSTRAP_SOURCE_ENV:?测试模式必须设置 PAIRESUME_BOOTSTRAP_SOURCE_ENV}"
  target_env="${PAIRESUME_BOOTSTRAP_TARGET_ENV:?测试模式必须设置 PAIRESUME_BOOTSTRAP_TARGET_ENV}"
  db_credentials_file="${PAIRESUME_BOOTSTRAP_DB_CREDENTIALS_FILE:?测试模式必须设置 PAIRESUME_BOOTSTRAP_DB_CREDENTIALS_FILE}"
else
  [[ "$(id -u)" == "0" ]] || die "必须以 root 身份生成 PaiResume 生产环境文件"
  [[ -z "${PAIRESUME_BOOTSTRAP_SOURCE_ENV:-}" \
    && -z "${PAIRESUME_BOOTSTRAP_TARGET_ENV:-}" \
    && -z "${PAIRESUME_BOOTSTRAP_DB_CREDENTIALS_FILE:-}" ]] \
    || die "生产模式不允许覆盖固定的源文件或目标文件路径"
  source_env="$production_source_env"
  target_env="$production_target_env"
  db_credentials_file="$production_db_credentials"
fi

[[ -f "$source_env" && ! -L "$source_env" ]] \
  || die "paicoding 环境文件不存在、不是普通文件或是符号链接"
[[ -f "$db_credentials_file" && ! -L "$db_credentials_file" ]] \
  || die "PaiResume MySQL 凭据文件不存在、不是普通文件或是符号链接"
if [[ "${PAIRESUME_BOOTSTRAP_TEST_MODE:-false}" != "true" ]]; then
  credentials_mode="$(stat -c '%a' "$db_credentials_file")"
  credentials_owner="$(stat -c '%U:%G' "$db_credentials_file")"
  [[ "$credentials_mode" == "600" && "$credentials_owner" == "root:root" ]] \
    || die "PaiResume MySQL 凭据文件必须是 root:root 600"
fi

target_dir="$(dirname "$target_env")"
if [[ -e "$target_env" ]]; then
  [[ -f "$target_env" && ! -L "$target_env" ]] \
    || die "现有 PaiResume 环境文件不是普通文件或是符号链接"
fi
if [[ -e "$target_dir" ]]; then
  [[ -d "$target_dir" && ! -L "$target_dir" ]] \
    || die "PaiResume 配置目录不是普通目录或是符号链接"
else
  install -d -m 0750 "$target_dir"
fi

trim_leading_space() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  TRIMMED_VALUE="$value"
}

trim_trailing_space() {
  local value="$1"
  value="${value%"${value##*[![:space:]]}"}"
  TRIMMED_VALUE="$value"
}

validate_value() {
  local name="$1"
  local value="$2"
  local allow_empty="${3:-false}"

  if [[ -z "$value" && "$allow_empty" != "true" ]]; then
    die "环境变量 ${name} 不能为空"
  fi
  if [[ "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    die "环境变量 ${name} 含换行符，已拒绝"
  fi
  if [[ ${#value} -gt 4096 ]]; then
    die "环境变量 ${name} 长度异常，已拒绝"
  fi
  if printf '%s' "$value" | grep -q '[[:cntrl:]]'; then
    die "环境变量 ${name} 含控制字符，已拒绝"
  fi
  # Generated EnvironmentFile values use systemd/bash-compatible single
  # quoting. Reject a quote instead of attempting ambiguous re-escaping.
  if [[ "$value" == *"'"* ]]; then
    die "环境变量 ${name} 含不安全引号，已拒绝"
  fi
}

# Sets LOOKUP_FOUND and LOOKUP_VALUE. The file is parsed as data: it is never
# sourced, expanded, eval'd, or echoed. Source application env files may opt
# into last-assignment-wins semantics so the selected value matches the
# already-running application; generated credentials and target files remain
# strict.
lookup_env_value() {
  local file="$1"
  local wanted_key="$2"
  local duplicate_policy="${3:-strict}"
  local line=""
  local line_number=0
  local key=""
  local raw_value=""
  local decoded_value=""

  LOOKUP_FOUND=false
  LOOKUP_VALUE=""
  if [[ "$duplicate_policy" != "strict" && "$duplicate_policy" != "last" ]]; then
    die "环境变量重复定义策略不合法"
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    line_number=$((line_number + 1))
    if [[ "$line" == *$'\r'* ]]; then
      die "环境文件第 ${line_number} 行含回车或换行注入，已拒绝"
    fi

    trim_leading_space "$line"
    line="$TRIMMED_VALUE"
    if [[ -z "$line" || "${line:0:1}" == "#" ]]; then
      continue
    fi
    if [[ "$line" == export[[:space:]]* ]]; then
      line="${line#export}"
      trim_leading_space "$line"
      line="$TRIMMED_VALUE"
    fi
    if [[ "$line" != *=* ]]; then
      die "环境文件第 ${line_number} 行格式不合法"
    fi

    key="${line%%=*}"
    trim_trailing_space "$key"
    key="$TRIMMED_VALUE"
    if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      die "环境文件第 ${line_number} 行变量名不合法"
    fi

    raw_value="${line#*=}"
    if [[ "$raw_value" == \"* || "$raw_value" == \'* ]]; then
      if [[ ${#raw_value} -lt 2 \
        || "${raw_value: -1}" != "${raw_value:0:1}" ]]; then
        die "环境变量 ${key} 的引号不完整"
      fi
      decoded_value="${raw_value:1:${#raw_value}-2}"
    else
      trim_leading_space "$raw_value"
      if [[ "$TRIMMED_VALUE" != "$raw_value" ]]; then
        die "环境变量 ${key} 的未引用值含前导空白，已拒绝"
      fi
      trim_trailing_space "$raw_value"
      if [[ "$TRIMMED_VALUE" != "$raw_value" ]]; then
        die "环境变量 ${key} 的未引用值含尾随空白，已拒绝"
      fi
      decoded_value="$raw_value"
    fi
    validate_value "$key" "$decoded_value" true

    if [[ "$key" == "$wanted_key" ]]; then
      if [[ "$LOOKUP_FOUND" == "true" ]]; then
        if [[ "$LOOKUP_VALUE" != "$decoded_value" ]]; then
          if [[ "$duplicate_policy" == "last" ]]; then
            LOOKUP_VALUE="$decoded_value"
            continue
          fi
          die "环境变量 ${wanted_key} 存在冲突的重复定义，已拒绝"
        fi
        continue
      fi
      LOOKUP_FOUND=true
      LOOKUP_VALUE="$decoded_value"
    fi
  done < "$file"
}

# Mandatory photo OSS values must come from an explicit PaiResume override or
# Sets SELECTED_VALUE to the first non-empty candidate.
select_required_source_value() {
  local description="$1"
  shift
  local candidate=""

  SELECTED_VALUE=""
  for candidate in "$@"; do
    lookup_env_value "$source_env" "$candidate" last
    if [[ "$LOOKUP_FOUND" == "true" && -n "$LOOKUP_VALUE" ]]; then
      SELECTED_VALUE="$LOOKUP_VALUE"
      validate_value "$description" "$SELECTED_VALUE"
      return 0
    fi
  done
  die "paicoding 环境文件缺少 ${description} 所需变量"
}

select_optional_source_value() {
  local default_value="$1"
  shift
  local candidate=""

  SELECTED_VALUE="$default_value"
  for candidate in "$@"; do
    lookup_env_value "$source_env" "$candidate" last
    if [[ "$LOOKUP_FOUND" == "true" && -n "$LOOKUP_VALUE" ]]; then
      SELECTED_VALUE="$LOOKUP_VALUE"
      return 0
    fi
  done
}

validate_boolean_override() {
  local name="$1"
  local value="$2"
  if [[ "$value" != "true" && "$value" != "false" ]]; then
    die "${name} 只能是 true 或 false"
  fi
}

validate_port() {
  local name="$1"
  local value="$2"
  if [[ ! "$value" =~ ^[0-9]+$ ]] || (( value < 1 || value > 65535 )); then
    die "${name} 不是有效端口"
  fi
}

validate_email() {
  local name="$1"
  local value="$2"
  if [[ ! "$value" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
    die "${name} 不是单个有效邮箱地址"
  fi
}

lookup_env_value "$db_credentials_file" MYSQL_USERNAME
[[ "$LOOKUP_FOUND" == "true" ]] || die "PaiResume MySQL 凭据文件缺少 MYSQL_USERNAME"
mysql_username="$LOOKUP_VALUE"
[[ "$mysql_username" == "$production_mysql_username" ]] \
  || die "PaiResume MySQL 凭据用户名必须固定为 ${production_mysql_username}"
lookup_env_value "$db_credentials_file" MYSQL_PASSWORD
[[ "$LOOKUP_FOUND" == "true" ]] || die "PaiResume MySQL 凭据文件缺少 MYSQL_PASSWORD"
mysql_password="$LOOKUP_VALUE"
validate_value "PaiResume 数据库密码" "$mysql_password"
[[ ${#mysql_password} -ge 32 ]] || die "PaiResume 数据库密码长度不足"

select_optional_source_value "127.0.0.1" PAICODING_REDIS_HOST REDIS_HOST
redis_host="$SELECTED_VALUE"
select_optional_source_value "6388" PAICODING_REDIS_PORT REDIS_PORT
redis_port="$SELECTED_VALUE"
validate_port "Redis 端口" "$redis_port"
select_required_source_value "Redis 密码" \
  PAICODING_REDIS_PASSWORD REDIS_PASSWORD
redis_password="$SELECTED_VALUE"

select_required_source_value "SMTP 主机" \
  PAICODING_MAIL_HOST MAIL_HOST SMTP_HOST
mail_host="$SELECTED_VALUE"
select_optional_source_value "465" PAICODING_MAIL_PORT MAIL_PORT SMTP_PORT
mail_port="$SELECTED_VALUE"
validate_port "SMTP 端口" "$mail_port"
select_required_source_value "SMTP 用户名" \
  PAICODING_MAIL_USERNAME MAIL_USERNAME SMTP_USERNAME
mail_username="$SELECTED_VALUE"
select_required_source_value "SMTP 密码" \
  PAICODING_MAIL_PASSWORD MAIL_PASSWORD SMTP_PASSWORD
mail_password="$SELECTED_VALUE"
select_required_source_value "发件邮箱" \
  PAICODING_MAIL_FROM MAIL_FROM
mail_from="$SELECTED_VALUE"
validate_email "发件邮箱" "$mail_from"

support_email="${PAIRESUME_SUPPORT_EMAIL:-}"
if [[ -z "$support_email" && -f "$target_env" ]]; then
  lookup_env_value "$target_env" VITE_SUPPORT_EMAIL
  if [[ "$LOOKUP_FOUND" == "true" ]]; then
    support_email="$LOOKUP_VALUE"
  fi
fi
if [[ -z "$support_email" ]]; then
  support_email="$mail_from"
fi
validate_email "对外客服邮箱" "$support_email"

select_optional_source_value "$mail_from" \
  PAICODING_MAIL_ALERM_USER PAICODING_MAIL_USER PAICODING_ALARM_EMAIL ALARM_EMAIL
alarm_mailboxes="$SELECTED_VALUE"
review_recipient="${alarm_mailboxes%%,*}"
trim_leading_space "$review_recipient"
review_recipient="$TRIMMED_VALUE"
trim_trailing_space "$review_recipient"
review_recipient="$TRIMMED_VALUE"
validate_email "人工精修收件箱" "$review_recipient"

select_required_source_value "DeepSeek API Key" \
  PAICODING_DEEPSEEK_API_KEY DEEPSEEK_API_KEY AI_API_KEY
deepseek_api_key="$SELECTED_VALUE"

# 知识星球灰度的首要入口是派聪明扫码注册/登录。生产环境生成脚本不得
# 再把已经验收可用的扫码能力静默写回关闭状态。
select_optional_source_value "https://paicoding.com" \
  PAIRESUME_WECHAT_GATEWAY_BASE_URL PAICONGMING_WECHAT_GATEWAY_BASE_URL
paicongming_gateway_base_url="$SELECTED_VALUE"
select_optional_source_value "/api/internal/pairesume/wechat/qrcodes" \
  PAIRESUME_WECHAT_GATEWAY_QR_PATH PAICONGMING_WECHAT_GATEWAY_QR_PATH
paicongming_gateway_qr_path="$SELECTED_VALUE"
select_required_source_value "派聪明扫码桥独立密钥" \
  PAIRESUME_WECHAT_BRIDGE_SECRET PAICONGMING_WECHAT_BRIDGE_SECRET
paicongming_bridge_secret="$SELECTED_VALUE"
select_required_source_value "派聪明服务号 AppID" \
  WX_APP_ID PAICONGMING_WECHAT_APP_ID
paicongming_app_id="$SELECTED_VALUE"
select_optional_source_value "pr_" \
  PAIRESUME_WECHAT_SCENE_PREFIX PAICONGMING_WECHAT_SCENE_PREFIX
paicongming_scene_prefix="$SELECTED_VALUE"

[[ "$paicongming_gateway_base_url" =~ ^https://[^/]+/?$ ]] \
  || die "派聪明扫码网关必须是明确的公网 HTTPS 根地址"
[[ "$paicongming_gateway_qr_path" =~ ^/[A-Za-z0-9_./-]+$ \
  && "$paicongming_gateway_qr_path" != //* ]] \
  || die "派聪明扫码网关路径必须是站内绝对路径"
[[ ${#paicongming_bridge_secret} -ge 32 ]] \
  || die "派聪明扫码桥独立密钥不得少于 32 个字符"
[[ "$paicongming_app_id" =~ ^wx[A-Za-z0-9]{16}$ ]] \
  || die "派聪明服务号 AppID 格式不正确"
[[ "$paicongming_scene_prefix" =~ ^[A-Za-z0-9_-]{2,16}$ ]] \
  || die "派聪明二维码场景前缀格式不正确"

planet_core_acceptance_confirmed="${PAIRESUME_PLANET_CORE_ACCEPTANCE_CONFIRMED:-false}"
validate_boolean_override \
  "PAIRESUME_PLANET_CORE_ACCEPTANCE_CONFIRMED" "$planet_core_acceptance_confirmed"

select_required_source_value "微信支付 App ID" \
  PAIRESUME_WECHAT_PAY_APP_ID WECHAT_PAY_APP_ID
wechat_pay_app_id="$SELECTED_VALUE"
select_required_source_value "微信支付商户号" \
  PAIRESUME_WECHAT_PAY_MERCHANT_ID WECHAT_PAY_MERCHANT_ID
wechat_pay_merchant_id="$SELECTED_VALUE"
select_required_source_value "微信支付商户私钥" \
  PAIRESUME_WECHAT_PAY_PRIVATE_KEY WECHAT_PAY_PRIVATE_KEY
wechat_pay_private_key="$SELECTED_VALUE"
select_required_source_value "微信支付商户证书序列号" \
  PAIRESUME_WECHAT_PAY_MERCHANT_SERIAL_NUMBER WECHAT_PAY_MERCHANT_SERIAL_NUMBER
wechat_pay_merchant_serial="$SELECTED_VALUE"
select_required_source_value "微信支付 API v3 Key" \
  PAIRESUME_WECHAT_PAY_API_V3_KEY WECHAT_PAY_API_V3_KEY
wechat_pay_api_v3_key="$SELECTED_VALUE"
[[ ${#wechat_pay_api_v3_key} -eq 32 ]] \
  || die "微信支付 API v3 Key 必须恰好为 32 个字符"

review_payment_confirmed="${PAIRESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED:-false}"
validate_boolean_override "PAIRESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED" "$review_payment_confirmed"
[[ "$review_payment_confirmed" == "true" ]] \
  || die "人工精修常驻服务要求先完成真实支付、邮件和退款验收"

operator_name="${PAIRESUME_OPERATOR_NAME:-沉默王二（个人开发者）}"
validate_value "PAIRESUME_OPERATOR_NAME" "$operator_name"

generate_secret() {
  command -v openssl >/dev/null 2>&1 \
    || die "缺少 openssl，无法生成应用密钥"
  GENERATED_SECRET="$(openssl rand -hex 48)"
  [[ "$GENERATED_SECRET" =~ ^[0-9a-f]{96}$ ]] \
    || die "openssl 未生成预期格式的应用密钥"
}

load_or_generate_application_secret() {
  local name="$1"

  APPLICATION_SECRET=""
  if [[ -f "$target_env" ]]; then
    lookup_env_value "$target_env" "$name"
    if [[ "$LOOKUP_FOUND" == "true" ]]; then
      APPLICATION_SECRET="$LOOKUP_VALUE"
      validate_value "$name" "$APPLICATION_SECRET"
      if [[ ${#APPLICATION_SECRET} -lt 32 ]]; then
        die "现有 ${name} 少于 32 个字符，拒绝静默轮换"
      fi
      return 0
    fi
  fi
  generate_secret
  APPLICATION_SECRET="$GENERATED_SECRET"
}

load_or_generate_application_secret JWT_SECRET
jwt_secret="$APPLICATION_SECRET"
load_or_generate_application_secret VERIFICATION_CODE_SECRET
verification_code_secret="$APPLICATION_SECRET"
if [[ "$jwt_secret" == "$verification_code_secret" ]]; then
  die "JWT_SECRET 与 VERIFICATION_CODE_SECRET 必须相互独立"
fi

load_or_generate_config_master_key() {
  config_master_key=""
  if [[ -f "$target_env" ]]; then
    lookup_env_value "$target_env" AI_PROVIDER_MASTER_KEY
    if [[ "$LOOKUP_FOUND" == "true" ]]; then
      config_master_key="$LOOKUP_VALUE"
    fi
  fi
  if [[ -z "$config_master_key" ]]; then
    command -v openssl >/dev/null 2>&1 \
      || die "缺少 openssl，无法生成后台配置加密主密钥"
    config_master_key="$(openssl rand -base64 32 | tr -d '\n')"
  fi
  [[ "$config_master_key" =~ ^[A-Za-z0-9+/]{43}=$ ]] \
    || die "AI_PROVIDER_MASTER_KEY 必须是 Base64 编码的 32 字节密钥"
}

load_or_generate_config_master_key

temporary_env="$(mktemp "${target_dir}/.pai-resume.env.tmp.XXXXXX")"
cleanup() {
  if [[ -n "${temporary_env:-}" && -f "$temporary_env" ]]; then
    rm -f -- "$temporary_env"
  fi
}
trap cleanup EXIT HUP INT TERM
chmod 0600 "$temporary_env"

write_env() {
  local name="$1"
  local value="$2"
  local allow_empty="${3:-false}"
  validate_value "$name" "$value" "$allow_empty"
  printf "%s='%s'\n" "$name" "$value" >> "$temporary_env"
}

{
  printf '# Generated by deploy/bootstrap-production-env.sh; do not edit secrets in shell history.\n'
  printf '# Re-running is idempotent for application secrets and the configuration master key.\n'
} >> "$temporary_env"

write_env APP_ENV production
write_env DEPLOY_STAGE free
write_env APP_TIME_ZONE Asia/Shanghai
write_env APP_PUBLIC_URL https://resume.paicoding.com
write_env APP_CORS_ALLOWED_ORIGIN_PATTERNS https://resume.paicoding.com
write_env RELEASE_ROOT /home/www/pairesume/current
write_env FIELD_OPTIMIZE_PROMPTS_FILE /home/www/pairesume/current/config/field-optimize-prompts.yml
write_env SERVER_ADDRESS "$production_server_address"
write_env SERVER_PORT "$production_server_port"
write_env SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE 5
write_env SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE 1
write_env SERVER_TOMCAT_THREADS_MAX 48
write_env SERVER_TOMCAT_THREADS_MIN_SPARE 4
write_env SERVER_TOMCAT_MAX_CONNECTIONS 256
write_env SERVER_TOMCAT_ACCEPT_COUNT 32
write_env VITE_SUPPORT_EMAIL "$support_email"
write_env VITE_OPERATOR_NAME "$operator_name"
write_env VITE_AI_PROVIDER_NAME DeepSeek
write_env VITE_AI_PROVIDER_PRIVACY_URL \
  https://cdn.deepseek.com/policies/zh-CN/deepseek-privacy-policy.html
write_env FORWARD_HEADERS_STRATEGY native
write_env REFRESH_COOKIE_SECURE true
write_env SPRINGDOC_ENABLED false

write_env PAICONGMING_WECHAT_LOGIN_ENABLED true
write_env PAICONGMING_WECHAT_GATEWAY_BASE_URL "$paicongming_gateway_base_url"
write_env PAICONGMING_WECHAT_GATEWAY_QR_PATH "$paicongming_gateway_qr_path"
write_env PAICONGMING_WECHAT_BRIDGE_SECRET "$paicongming_bridge_secret"
write_env PAICONGMING_WECHAT_APP_ID "$paicongming_app_id"
write_env PAICONGMING_WECHAT_SCENE_PREFIX "$paicongming_scene_prefix"
write_env PLANET_CORE_ACCEPTANCE_CONFIRMED "$planet_core_acceptance_confirmed"
write_env VIP_INVITE_CLAIM_TTL_SECONDS 600
write_env VIP_INVITE_CLAIM_RETENTION_DAYS 30

write_env JWT_SECRET "$jwt_secret"
write_env VERIFICATION_CODE_SECRET "$verification_code_secret"
write_env AI_PROVIDER_MASTER_KEY "$config_master_key"

write_env MYSQL_HOST "$production_mysql_host"
write_env MYSQL_PORT "$production_mysql_port"
write_env MYSQL_DATABASE "$production_mysql_database"
write_env MYSQL_SHARED_ACCOUNT_CONFIRMED true
write_env MYSQL_USERNAME "$mysql_username"
write_env MYSQL_PASSWORD "$mysql_password"
write_env FLYWAY_USERNAME "$mysql_username"
write_env FLYWAY_PASSWORD "$mysql_password"
write_env FLYWAY_ENABLED true
write_env MYSQL_USE_SSL true
write_env MYSQL_REQUIRE_SSL true
write_env MYSQL_VERIFY_SERVER_CERTIFICATE true
write_env MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL false
write_env PAIRESUME_BACKUP_MYSQL_USERNAME root
write_env PAIRESUME_BACKUP_MYSQL_SOCKET /var/lib/mysql/mysql.sock

write_env REDIS_HOST "$redis_host"
write_env REDIS_PORT "$redis_port"
write_env REDIS_PASSWORD "$redis_password"
write_env REDIS_DATABASE 1
write_env REDIS_KEY_PREFIX pairesume:prod:

write_env MAIL_HOST "$mail_host"
write_env MAIL_PORT "$mail_port"
write_env MAIL_USERNAME "$mail_username"
write_env MAIL_PASSWORD "$mail_password"
write_env MAIL_FROM "$mail_from"
write_env MAIL_TEST_CONNECTION true
write_env MAIL_SMTP_AUTH true
if [[ "$mail_port" == "465" ]]; then
  write_env MAIL_STARTTLS_ENABLE false
  write_env MAIL_STARTTLS_REQUIRED false
  write_env MAIL_SSL_ENABLE true
else
  write_env MAIL_STARTTLS_ENABLE true
  write_env MAIL_STARTTLS_REQUIRED true
  write_env MAIL_SSL_ENABLE false
fi
write_env MAIL_SSL_CHECK_SERVER_IDENTITY true
write_env MAIL_CONNECTION_TIMEOUT_MS 10000
write_env MAIL_READ_TIMEOUT_MS 10000
write_env MAIL_WRITE_TIMEOUT_MS 10000

write_env RESUME_REVIEW_RECIPIENT_EMAIL "$review_recipient"
write_env RESUME_REVIEW_MESSAGE_ID_DOMAIN resume.paicoding.com
write_env RESUME_REVIEW_MAIL_OUTBOX_MAX_ATTEMPTS 10
write_env RESUME_REVIEW_UPLOAD_RATE_LIMIT_WINDOW_SECONDS 900
write_env RESUME_REVIEW_UPLOAD_RATE_LIMIT_ACCOUNT_ATTEMPTS 20
write_env RESUME_REVIEW_UPLOAD_RATE_LIMIT_IP_ATTEMPTS 200
write_env RESUME_PHOTO_OSS_STAGING_PREFIX pairesume/resume-photo/staging/
write_env RESUME_PHOTO_OSS_OBJECT_PREFIX pairesume/resume-photo/objects/
write_env RESUME_PHOTO_OSS_UPLOAD_URL_TTL_MINUTES 10
write_env RESUME_PHOTO_OSS_ACCESS_URL_TTL_MINUTES 60
write_env RESUME_PHOTO_OSS_MAX_BYTES 3145728
write_env RESUME_PHOTO_OSS_MAX_DIMENSION 4096
write_env RESUME_PHOTO_OSS_MAX_PIXELS 16000000
write_env RESUME_PHOTO_UPLOAD_RATE_LIMIT_WINDOW_SECONDS 900
write_env RESUME_PHOTO_UPLOAD_RATE_LIMIT_ACCOUNT_ATTEMPTS 20
write_env RESUME_PHOTO_UPLOAD_RATE_LIMIT_IP_ATTEMPTS 200
write_env RESUME_REVIEW_PAYMENT_ORDER_EXPIRE_MINUTES 30
write_env RESUME_REVIEW_PAYMENT_ACCEPTANCE_CONFIRMED "$review_payment_confirmed"

write_env AI_API_KEY "$deepseek_api_key"
write_env AI_BASE_URL https://api.deepseek.com
write_env AI_MODEL deepseek-v4-flash
write_env AI_ANALYSIS_MODEL deepseek-v4-flash

write_env PAYMENT_PROVIDER wechat-native
write_env PAYMENT_ACCEPT_NEW_ORDERS false
write_env MEMBERSHIP_PAYMENT_ACCEPT_NEW_ORDERS false
write_env MARKETPLACE_PAYMENT_ACCEPT_NEW_ORDERS false
write_env SHOWCASE_PAYMENT_ACCEPT_NEW_ORDERS false
write_env MARKETPLACE_ENABLED false
write_env PAYMENT_ORDER_EXPIRE_MINUTES 15
write_env MEMBERSHIP_ORDER_EXPIRE_MINUTES 30
write_env MARKETPLACE_PLATFORM_FEE_BPS 0
write_env MARKETPLACE_EARNING_HOLD_DAYS 7
write_env MARKETPLACE_PAID_RECONCILIATION_INTERVAL_MINUTES 360
write_env MARKETPLACE_PAID_DUE_RECONCILIATION_RETRY_MINUTES 5
write_env PAYMENT_MOCK_AUTO_PAY false
write_env MEMBERSHIP_PAYMENT_ACCEPTANCE_CONFIRMED false
write_env MARKETPLACE_PAYMENT_ACCEPTANCE_CONFIRMED false
write_env MARKETPLACE_GOVERNANCE_DUTY_CONFIRMED false
write_env PAYMENT_ACCEPTANCE_ENVIRONMENT_CONFIRMED false
write_env WECHAT_PAY_APP_ID "$wechat_pay_app_id"
write_env WECHAT_PAY_MERCHANT_ID "$wechat_pay_merchant_id"
write_env WECHAT_PAY_PRIVATE_KEY "$wechat_pay_private_key"
write_env WECHAT_PAY_MERCHANT_SERIAL_NUMBER "$wechat_pay_merchant_serial"
write_env WECHAT_PAY_API_V3_KEY "$wechat_pay_api_v3_key"
write_env WECHAT_PAY_NOTIFY_URL \
  https://resume.paicoding.com/api/public/payments/wechat/notify
write_env WECHAT_PAY_REFUND_NOTIFY_URL \
  https://resume.paicoding.com/api/public/payments/wechat/refund-notify

chmod 0600 "$temporary_env"
if [[ "${PAIRESUME_BOOTSTRAP_TEST_MODE:-false}" != "true" ]]; then
  chown root:root "$temporary_env"
fi
mv -f -- "$temporary_env" "$target_env"
temporary_env=""
trap - EXIT HUP INT TERM

printf '%s\n' \
  "PaiResume 生产环境文件已原子更新；JWT/验证码密钥已保留或首次生成，未输出任何配置值。"
