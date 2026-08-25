CREATE TABLE IF NOT EXISTS `resume_photo_oss_config` (
    `id` TINYINT NOT NULL COMMENT 'fixed single row, always 1',
    `endpoint` VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'HTTPS OSS endpoint without path',
    `bucket` VARCHAR(63) NOT NULL DEFAULT '' COMMENT 'private OSS bucket',
    `access_key_id_cipher` BLOB NULL COMMENT 'AES-256-GCM encrypted AccessKey ID',
    `access_key_id_mask` VARCHAR(32) NULL COMMENT 'masked AccessKey ID for admin display',
    `access_key_secret_cipher` BLOB NULL COMMENT 'AES-256-GCM encrypted AccessKey secret',
    `access_key_secret_mask` VARCHAR(32) NULL COMMENT 'masked AccessKey secret for admin display',
    `private_bucket_confirmed` TINYINT NOT NULL DEFAULT 0,
    `cors_confirmed` TINYINT NOT NULL DEFAULT 0,
    `staging_lifecycle_confirmed` TINYINT NOT NULL DEFAULT 0,
    `ram_policy_confirmed` TINYINT NOT NULL DEFAULT 0,
    `enabled` TINYINT NOT NULL DEFAULT 0 COMMENT 'photo storage is usable only when enabled',
    `updated_by` BIGINT NULL COMMENT 'last admin user',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `chk_resume_photo_oss_single_row` CHECK (`id` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='admin-managed encrypted resume photo OSS configuration';

INSERT INTO `resume_photo_oss_config` (`id`) VALUES (1)
ON DUPLICATE KEY UPDATE `id` = `id`;

CREATE TABLE IF NOT EXISTS `resume_photo_oss_config_audit` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `admin_user_id` BIGINT NOT NULL,
    `action` VARCHAR(32) NOT NULL COMMENT 'UPDATE or TEST',
    `changed_fields` VARCHAR(255) NULL COMMENT 'field names only, never values',
    `credentials_rotated` TINYINT NOT NULL DEFAULT 0,
    `detail` VARCHAR(512) NULL COMMENT 'result summary without credentials',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_resume_photo_oss_audit_admin` (`admin_user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='resume photo OSS configuration audit';
