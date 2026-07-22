ALTER TABLE `resume_view_order`
    ADD COLUMN `sale_closed_at` DATETIME NULL COMMENT '该订单对应销售版本停止接单的时间' AFTER `last_checked_at`,
    ADD COLUMN `sale_close_reason` VARCHAR(32) NULL COMMENT '销售关闭原因' AFTER `sale_closed_at`,
    ADD COLUMN `payment_review_reason` VARCHAR(64) NULL COMMENT '人工退款或支付复核原因' AFTER `sale_close_reason`,
    ADD COLUMN `refund_reference` VARCHAR(128) NULL COMMENT '商户平台退款单号或核验流水' AFTER `payment_review_reason`,
    ADD COLUMN `refund_note` VARCHAR(255) NULL COMMENT '人工退款备注' AFTER `refund_reference`,
    ADD COLUMN `refund_resolved_by` BIGINT NULL COMMENT '确认退款的管理员 ID' AFTER `refund_note`,
    ADD COLUMN `refund_resolved_at` DATETIME NULL COMMENT '管理员确认外部退款完成时间' AFTER `refund_resolved_by`,
    ADD KEY `idx_resume_view_order_close_work` (`sale_closed_at`, `active_order_key`, `id`),
    ADD KEY `idx_resume_view_order_review` (`order_status`, `updated_at`),
    ADD UNIQUE KEY `uk_resume_view_order_refund_reference` (`provider`, `refund_reference`);
