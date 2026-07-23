ALTER TABLE `membership_payment_order`
    ADD COLUMN `review_status` VARCHAR(24) NOT NULL DEFAULT 'NONE'
        COMMENT 'NONE/PENDING/REFUND_PROCESSING/REFUNDED/REJECTED/CLOSED'
        AFTER `payment_review_reason`,
    ADD COLUMN `last_admin_action` VARCHAR(32) NULL COMMENT '最近一次人工处置动作'
        AFTER `review_status`,
    ADD COLUMN `admin_action_reason` VARCHAR(255) NULL COMMENT '最近一次人工处置原因'
        AFTER `last_admin_action`,
    ADD COLUMN `handled_by` BIGINT NULL COMMENT '最近一次处置管理员用户 ID'
        AFTER `admin_action_reason`,
    ADD COLUMN `refund_reference` VARCHAR(128) NULL COMMENT '商户平台退款单号或核验流水'
        AFTER `handled_by`,
    ADD COLUMN `review_started_at` DATETIME NULL COMMENT '开始退款处理时间'
        AFTER `refund_reference`,
    ADD COLUMN `review_resolved_at` DATETIME NULL COMMENT '人工复核终结时间'
        AFTER `review_started_at`,
    ADD COLUMN `review_updated_at` DATETIME NULL COMMENT '最近一次人工复核操作时间'
        AFTER `review_resolved_at`,
    ADD UNIQUE KEY `uk_membership_order_refund_reference` (`refund_reference`),
    ADD KEY `idx_membership_order_review` (`review_status`, `paid_at`, `id`),
    ADD CONSTRAINT `fk_membership_order_handled_by`
        FOREIGN KEY (`handled_by`) REFERENCES `user` (`id`);

UPDATE `membership_payment_order`
SET `review_status` = 'PENDING',
    `review_updated_at` = COALESCE(`paid_at`, `updated_at`)
WHERE `order_status` = 'REFUND_REQUIRED'
  AND `review_status` = 'NONE';

CREATE TABLE `membership_payment_order_audit_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `order_id` BIGINT NOT NULL COMMENT '会员支付订单 ID',
    `order_no` VARCHAR(64) NOT NULL COMMENT '会员支付订单号快照',
    `admin_user_id` BIGINT NOT NULL COMMENT '操作管理员用户 ID',
    `action` VARCHAR(32) NOT NULL COMMENT '人工处置动作',
    `from_status` VARCHAR(24) NOT NULL COMMENT '处置前复核状态',
    `to_status` VARCHAR(24) NOT NULL COMMENT '处置后复核状态',
    `reason` VARCHAR(255) NOT NULL COMMENT '操作原因',
    `refund_reference` VARCHAR(128) NULL COMMENT '退款单号或核验流水快照',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '审计时间',
    PRIMARY KEY (`id`),
    KEY `idx_membership_payment_audit_order` (`order_id`, `created_at`, `id`),
    KEY `idx_membership_payment_audit_admin` (`admin_user_id`, `created_at`, `id`),
    CONSTRAINT `fk_membership_payment_audit_order`
        FOREIGN KEY (`order_id`) REFERENCES `membership_payment_order` (`id`),
    CONSTRAINT `fk_membership_payment_audit_admin`
        FOREIGN KEY (`admin_user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员支付人工处置审计日志';
