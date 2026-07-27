CREATE TABLE IF NOT EXISTS `membership_plan` (
    `plan_code` VARCHAR(32) NOT NULL COMMENT '稳定方案编码',
    `display_name` VARCHAR(64) NOT NULL COMMENT '方案展示名称',
    `entitlement_type` VARCHAR(16) NOT NULL COMMENT 'FIXED_DAYS/PERMANENT',
    `membership_days` INT NULL COMMENT '固定期限天数；永久会员为空',
    `price_cents` INT NULL COMMENT '售价，单位分；未定价时为空',
    `enabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否允许报价和下单',
    `recommended` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否为推荐方案',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT '展示顺序',
    `updated_by` BIGINT NULL COMMENT '最后更新管理员',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`plan_code`),
    KEY `idx_membership_plan_display` (`sort_order`, `plan_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员购买方案';

INSERT INTO `membership_plan` (
    `plan_code`, `display_name`, `entitlement_type`, `membership_days`,
    `price_cents`, `enabled`, `recommended`, `sort_order`
)
VALUES
    ('MONTHLY', '月卡', 'FIXED_DAYS', 30, NULL, 0, 0, 10),
    ('QUARTERLY', '季卡', 'FIXED_DAYS', 90, NULL, 0, 0, 20),
    ('LIFETIME', '终身会员', 'PERMANENT', NULL, NULL, 0, 0, 40)
ON DUPLICATE KEY UPDATE `plan_code` = `plan_code`;

INSERT INTO `membership_plan` (
    `plan_code`, `display_name`, `entitlement_type`, `membership_days`,
    `price_cents`, `enabled`, `recommended`, `sort_order`
)
SELECT
    'ANNUAL', '年卡', 'FIXED_DAYS', 365,
    CASE WHEN `membership_price_cents` > 0 THEN `membership_price_cents` ELSE NULL END,
    CASE WHEN `membership_price_cents` > 0 THEN 1 ELSE 0 END,
    1, 30
FROM `platform_config`
WHERE `id` = 1
ON DUPLICATE KEY UPDATE `plan_code` = `plan_code`;

ALTER TABLE `membership_payment_order`
    ADD COLUMN `plan_code` VARCHAR(32) NULL COMMENT '会员方案编码快照' AFTER `coupon_code_snapshot`,
    ADD COLUMN `plan_name_snapshot` VARCHAR(64) NULL COMMENT '会员方案名称快照' AFTER `plan_code`,
    ADD COLUMN `entitlement_type` VARCHAR(16) NULL COMMENT 'FIXED_DAYS/PERMANENT 权益快照' AFTER `plan_name_snapshot`;

UPDATE `membership_payment_order`
SET
    `plan_code` = CASE
        WHEN `membership_days` = 365 THEN 'ANNUAL'
        ELSE 'LEGACY_FIXED_DAYS'
    END,
    `plan_name_snapshot` = CASE
        WHEN `membership_days` = 365 THEN '年卡'
        ELSE CONCAT('历史会员（', `membership_days`, ' 天）')
    END,
    `entitlement_type` = 'FIXED_DAYS'
WHERE `plan_code` IS NULL;

ALTER TABLE `membership_payment_order`
    MODIFY COLUMN `plan_code` VARCHAR(32) NOT NULL DEFAULT 'ANNUAL'
        COMMENT '会员方案编码快照；默认值仅用于兼容回滚到旧版应用',
    MODIFY COLUMN `plan_name_snapshot` VARCHAR(64) NOT NULL DEFAULT '年卡'
        COMMENT '会员方案名称快照；默认值仅用于兼容回滚到旧版应用',
    MODIFY COLUMN `entitlement_type` VARCHAR(16) NOT NULL DEFAULT 'FIXED_DAYS'
        COMMENT 'FIXED_DAYS/PERMANENT 权益快照；默认值仅用于兼容回滚到旧版应用',
    MODIFY COLUMN `membership_days` INT NULL COMMENT '固定期限天数快照；永久会员为空',
    ADD KEY `idx_membership_order_plan` (`plan_code`, `created_at`);
