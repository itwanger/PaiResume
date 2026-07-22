ALTER TABLE `resume_view_order`
    ADD COLUMN `provider_reconciled_at` DATETIME NULL
        COMMENT '最近一次通过支付提供方验真并成功落库的时间' AFTER `last_checked_at`,
    ADD COLUMN `reconcile_lease_token` VARCHAR(64) NULL
        COMMENT '主动对账任务的跨节点租约令牌' AFTER `provider_reconciled_at`,
    ADD COLUMN `reconcile_lease_until` DATETIME NULL
        COMMENT '主动对账任务租约截止时间' AFTER `reconcile_lease_token`,
    ADD KEY `idx_resume_view_order_reconcile_work`
        (`sale_closed_at`, `provider`, `order_status`, `reconcile_lease_until`, `last_checked_at`, `id`);
