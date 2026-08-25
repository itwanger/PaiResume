ALTER TABLE `platform_config`
    ADD COLUMN `resume_review_recipient_email` VARCHAR(128) NULL
        COMMENT '后台配置的人工精修私密收件箱' AFTER `resume_review_price_cents`;

ALTER TABLE `resume_review_request`
    MODIFY COLUMN `entitlement_type` VARCHAR(24) NOT NULL
        COMMENT '历史 WELCOME_FREE/FOLLOW_REWARD，会员排队 MEMBERSHIP，付费加急 PAID',
    ADD COLUMN `queued_at` DATETIME NULL
        COMMENT 'SMTP 确认收件后正式进入公开队列的时间' AFTER `paid_at`,
    DROP KEY `idx_resume_review_priority_queue`,
    ADD KEY `idx_resume_review_priority_queue`
        (`request_status`, `priority_fee_cents`, `queued_at`, `id`);

UPDATE `resume_review_request` r
JOIN `resume_review_mail_outbox` o ON o.`request_id` = r.`id`
SET r.`queued_at` = COALESCE(o.`sent_at`, r.`paid_at`, r.`created_at`)
WHERE r.`request_status` IN ('EMAILED', 'ACCEPTED')
  AND r.`queued_at` IS NULL;
