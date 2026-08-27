CREATE TABLE IF NOT EXISTS `wechat_pay_config` (
    `id` TINYINT NOT NULL COMMENT 'fixed single row, always 1',
    `app_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'WeChat Pay application ID',
    `merchant_id` VARCHAR(32) NOT NULL DEFAULT '' COMMENT 'WeChat Pay merchant ID',
    `private_key_cipher` MEDIUMBLOB NULL COMMENT 'AES-256-GCM encrypted merchant private key',
    `private_key_mask` VARCHAR(32) NULL COMMENT 'masked merchant private key state',
    `merchant_serial_number` VARCHAR(128) NOT NULL DEFAULT '' COMMENT 'merchant certificate serial number',
    `api_v3_key_cipher` BLOB NULL COMMENT 'AES-256-GCM encrypted API v3 key',
    `api_v3_key_mask` VARCHAR(32) NULL COMMENT 'masked API v3 key',
    `payment_notify_url` VARCHAR(255) NOT NULL
        DEFAULT 'https://resume.paicoding.com/api/public/payments/wechat/notify',
    `refund_notify_url` VARCHAR(255) NOT NULL
        DEFAULT 'https://resume.paicoding.com/api/public/payments/wechat/refund-notify',
    `enabled` TINYINT NOT NULL DEFAULT 0 COMMENT '1 uses this row; 0 falls back to environment variables',
    `updated_by` BIGINT NULL COMMENT 'last admin user',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `chk_wechat_pay_config_single_row` CHECK (`id` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='admin-managed encrypted WeChat Pay configuration';

INSERT INTO `wechat_pay_config` (`id`) VALUES (1)
ON DUPLICATE KEY UPDATE `id` = `id`;

CREATE TABLE IF NOT EXISTS `wechat_pay_config_audit` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `admin_user_id` BIGINT NOT NULL,
    `action` VARCHAR(32) NOT NULL COMMENT 'UPDATE',
    `changed_fields` VARCHAR(255) NULL COMMENT 'field names only, never values',
    `credentials_rotated` TINYINT NOT NULL DEFAULT 0,
    `detail` VARCHAR(512) NULL COMMENT 'result summary without credentials or callback values',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_wechat_pay_config_audit_admin` (`admin_user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='WeChat Pay configuration audit';
