ALTER TABLE `resume_showcase`
    ADD COLUMN `price_cents` INT NOT NULL DEFAULT 0
        COMMENT '单份简历永久解锁价格，单位分' AFTER `access_type`;

-- 纠正上一版迁移中对这份精选简历访问方式的误判；首次价格沿用管理员
-- 当前已配置的支付价格，之后由每份简历的“精选设置”独立维护。
UPDATE `resume_showcase`
SET `access_type` = 'PAID',
    `price_cents` = COALESCE(
        (SELECT NULLIF(`membership_price_cents`, 0)
         FROM `platform_config`
         WHERE `id` = 1),
        0
    )
WHERE `slug` = 'featured-65';

CREATE TABLE `showcase_purchase_order` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `order_no` VARCHAR(64) NOT NULL COMMENT '平台订单号',
    `showcase_id` BIGINT NOT NULL COMMENT '官方精选简历 ID',
    `purchase_token_hash` CHAR(64) NOT NULL COMMENT '匿名购买凭证 SHA-256',
    `idempotency_key` VARCHAR(64) NOT NULL COMMENT '客户端幂等键',
    `active_order_key` VARCHAR(160) NULL COMMENT '同一凭证与简历的未结束订单唯一键',
    `amount_cents` INT NOT NULL COMMENT '实付金额快照，单位分',
    `currency` VARCHAR(8) NOT NULL DEFAULT 'CNY' COMMENT '币种',
    `provider` VARCHAR(24) NOT NULL COMMENT '支付提供方',
    `pay_channel` VARCHAR(24) NOT NULL COMMENT '支付渠道',
    `order_status` VARCHAR(24) NOT NULL DEFAULT 'CREATED' COMMENT '订单状态',
    `provider_prepay_id` VARCHAR(128) NULL COMMENT '支付平台预支付标识',
    `code_url` TEXT NULL COMMENT 'Native 支付二维码内容',
    `provider_transaction_id` VARCHAR(128) NULL COMMENT '支付平台交易号',
    `expires_at` DATETIME NOT NULL COMMENT '订单过期时间',
    `paid_at` DATETIME NULL COMMENT '支付完成时间',
    `closed_at` DATETIME NULL COMMENT '订单关闭时间',
    `refunded_at` DATETIME NULL COMMENT '退款完成时间',
    `last_checked_at` DATETIME NULL COMMENT '最近一次主动查单时间',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_showcase_purchase_order_no` (`order_no`),
    UNIQUE KEY `uk_showcase_purchase_idempotency` (`purchase_token_hash`, `idempotency_key`),
    UNIQUE KEY `uk_showcase_purchase_active` (`active_order_key`),
    UNIQUE KEY `uk_showcase_purchase_transaction` (`provider`, `provider_transaction_id`),
    KEY `idx_showcase_purchase_access` (`showcase_id`, `purchase_token_hash`, `order_status`),
    KEY `idx_showcase_purchase_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='官方精选简历匿名单份解锁订单';
