CREATE TABLE IF NOT EXISTS `ai_provider_config` (
    `id` TINYINT NOT NULL COMMENT '固定单行，恒为 1',
    `display_name` VARCHAR(64) NOT NULL COMMENT '服务商显示名称，用于用户端披露',
    `base_url` VARCHAR(255) NOT NULL COMMENT 'OpenAI 兼容 Base URL',
    `general_model` VARCHAR(64) NOT NULL COMMENT '通用模型',
    `analysis_model` VARCHAR(64) NOT NULL COMMENT '简历分析模型',
    `api_key_cipher` BLOB NULL COMMENT 'AES-256-GCM 密文：12 字节 IV + 密文 + 16 字节认证标签',
    `api_key_mask` VARCHAR(32) NULL COMMENT 'API Key 掩码，仅用于后台展示',
    `privacy_policy_url` VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'AI 服务商隐私政策 URL',
    `enabled` TINYINT NOT NULL DEFAULT 0 COMMENT '启用后 AiService 改用本配置，关闭则回退环境变量',
    `updated_by` BIGINT NULL COMMENT '最后更新管理员',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    CONSTRAINT `chk_ai_provider_single_row` CHECK (`id` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 服务商安全配置（单行）';

INSERT INTO `ai_provider_config` (
    `id`, `display_name`, `base_url`, `general_model`, `analysis_model`, `enabled`
) VALUES (
    1, 'DeepSeek', 'https://api.deepseek.com/v1', 'deepseek-chat', 'deepseek-chat', 0
) ON DUPLICATE KEY UPDATE `id` = `id`;

CREATE TABLE IF NOT EXISTS `ai_provider_config_audit` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `admin_user_id` BIGINT NOT NULL COMMENT '操作管理员',
    `action` VARCHAR(32) NOT NULL COMMENT 'UPDATE / TEST',
    `changed_fields` VARCHAR(255) NULL COMMENT '本次变更字段名列表，不含值',
    `api_key_rotated` TINYINT NOT NULL DEFAULT 0 COMMENT '是否轮换了 API Key',
    `detail` VARCHAR(512) NULL COMMENT '结果摘要，绝不包含明文或密文',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    PRIMARY KEY (`id`),
    KEY `idx_ai_provider_audit_admin` (`admin_user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 服务商配置变更与连接测试审计';
