ALTER TABLE `platform_config`
    ADD COLUMN `resume_review_price_cents` INT NOT NULL DEFAULT 0
        COMMENT '第三次及以后人工精修单次价格（分）'
        AFTER `questionnaire_coupon_amount_cents`;

CREATE TABLE `resume_review_quota_identity` (
    `identity_hash` CHAR(64) NOT NULL COMMENT '登录主体 provider+principal 的不可逆摘要',
    `quota_subject_hash` CHAR(64) NOT NULL COMMENT '多登录方式共享的精修额度主体',
    `first_user_id` BIGINT NOT NULL COMMENT '首次建立映射的用户，注销后仍保留防绕过',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`identity_hash`),
    KEY `idx_review_quota_subject` (`quota_subject_hash`),
    KEY `idx_review_quota_first_user` (`first_user_id`),
    CONSTRAINT `fk_review_quota_first_user` FOREIGN KEY (`first_user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='人工精修额度身份合并与注销防绕过';

CREATE TABLE `resume_review_follow_challenge` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `challenge_code` VARCHAR(24) NOT NULL COMMENT '用户发送给沉默王二公众号的高熵挑战码',
    `user_id` BIGINT NOT NULL,
    `active_user_key` VARCHAR(64) NULL,
    `challenge_status` VARCHAR(16) NOT NULL COMMENT 'ACTIVE/REDEEMED/EXPIRED',
    `expires_at` DATETIME NOT NULL,
    `redeemed_at` DATETIME NULL,
    `bridge_event_hash` CHAR(64) NULL,
    `wechat_openid_hash` CHAR(64) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_review_follow_challenge_code` (`challenge_code`),
    UNIQUE KEY `uk_review_follow_challenge_active_user` (`active_user_key`),
    UNIQUE KEY `uk_review_follow_challenge_event` (`bridge_event_hash`),
    KEY `idx_review_follow_challenge_user` (`user_id`, `created_at`),
    CONSTRAINT `fk_review_follow_challenge_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='沉默王二公众号关注奖励挑战';

CREATE TABLE `resume_review_follow_reward` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `quota_subject_hash` CHAR(64) NOT NULL COMMENT '绑定登录主体，防止注销重建账号重复领取',
    `source_type` VARCHAR(24) NOT NULL COMMENT 'WECHAT_BRIDGE/ADMIN_FALLBACK',
    `source_reference_hash` CHAR(64) NOT NULL,
    `consumed_request_id` BIGINT NULL,
    `issued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `consumed_at` DATETIME NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_review_follow_reward_user` (`user_id`),
    UNIQUE KEY `uk_review_follow_reward_subject` (`quota_subject_hash`),
    UNIQUE KEY `uk_review_follow_reward_source` (`source_reference_hash`),
    UNIQUE KEY `uk_review_follow_reward_request` (`consumed_request_id`),
    CONSTRAINT `fk_review_follow_reward_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每账号仅一次的沉默王二公众号关注奖励';

CREATE TABLE `resume_review_follow_fallback_code` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `code_hash` CHAR(64) NOT NULL,
    `code_hint` VARCHAR(8) NOT NULL COMMENT '仅供管理员识别，不能用于兑换',
    `code_status` VARCHAR(16) NOT NULL COMMENT 'ISSUED/REDEEMED/EXPIRED/REVOKED',
    `created_by` BIGINT NOT NULL,
    `redeemed_by` BIGINT NULL,
    `expires_at` DATETIME NOT NULL,
    `redeemed_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_review_follow_fallback_hash` (`code_hash`),
    KEY `idx_review_follow_fallback_status` (`code_status`, `expires_at`),
    CONSTRAINT `fk_review_follow_fallback_creator` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`),
    CONSTRAINT `fk_review_follow_fallback_redeemer` FOREIGN KEY (`redeemed_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='公众号回调故障时的人工兑换码，不代表实时关注验证';

CREATE TABLE `resume_review_request` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `request_no` VARCHAR(64) NOT NULL COMMENT 'RR 前缀人工精修请求号',
    `user_id` BIGINT NOT NULL,
    `quota_subject_hash` CHAR(64) NOT NULL COMMENT '当时登录主体的不可逆摘要',
    `resume_id` BIGINT NOT NULL,
    `idempotency_key` VARCHAR(64) NOT NULL,
    `active_user_key` VARCHAR(64) NULL COMMENT '确保同一用户最多一个活动请求',
    `contact_email` VARCHAR(128) NOT NULL,
    `snapshot_json` LONGTEXT NOT NULL COMMENT '不可变的服务端简历快照',
    `content_hash` CHAR(64) NOT NULL,
    `review_consent_version` VARCHAR(32) NOT NULL,
    `review_consent_at` DATETIME NOT NULL,
    `email_consent_version` VARCHAR(32) NOT NULL,
    `email_consent_at` DATETIME NOT NULL,
    `entitlement_type` VARCHAR(24) NOT NULL COMMENT 'WELCOME_FREE/FOLLOW_REWARD/PAID',
    `request_status` VARCHAR(24) NOT NULL COMMENT 'AWAITING_PAYMENT/EMAIL_PENDING/EMAILED/ACCEPTED/COMPLETED/RETURNED/REFUND_REQUIRED/REFUNDED',
    `price_cents` INT NOT NULL,
    `order_no` VARCHAR(64) NULL COMMENT 'PS 前缀人工精修支付单号',
    `provider` VARCHAR(24) NULL,
    `pay_channel` VARCHAR(24) NULL,
    `payment_status` VARCHAR(24) NULL,
    `provider_prepay_id` VARCHAR(128) NULL,
    `code_url` TEXT NULL,
    `provider_transaction_id` VARCHAR(128) NULL,
    `payment_expires_at` DATETIME NULL,
    `paid_at` DATETIME NULL,
    `refund_reason` VARCHAR(255) NULL,
    `refund_reference` VARCHAR(128) NULL,
    `handled_by` BIGINT NULL,
    `accepted_at` DATETIME NULL,
    `completed_at` DATETIME NULL,
    `returned_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_resume_review_request_no` (`request_no`),
    UNIQUE KEY `uk_resume_review_order_no` (`order_no`),
    UNIQUE KEY `uk_resume_review_idempotency` (`user_id`, `idempotency_key`),
    UNIQUE KEY `uk_resume_review_active_user` (`active_user_key`),
    UNIQUE KEY `uk_resume_review_provider_tx` (`provider`, `provider_transaction_id`),
    UNIQUE KEY `uk_resume_review_refund_ref` (`refund_reference`),
    KEY `idx_resume_review_queue` (`request_status`, `created_at`),
    KEY `idx_resume_review_user` (`user_id`, `created_at`),
    KEY `idx_resume_review_subject` (`quota_subject_hash`, `created_at`),
    CONSTRAINT `fk_resume_review_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`),
    CONSTRAINT `fk_resume_review_resume` FOREIGN KEY (`resume_id`) REFERENCES `resume` (`id`),
    CONSTRAINT `fk_resume_review_handler` FOREIGN KEY (`handled_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='人工简历精修请求与独立支付订单快照';

ALTER TABLE `resume_review_follow_reward`
    ADD CONSTRAINT `fk_review_follow_reward_request`
        FOREIGN KEY (`consumed_request_id`) REFERENCES `resume_review_request` (`id`);

CREATE TABLE `resume_review_credit_ledger` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `request_id` BIGINT NOT NULL,
    `credit_type` VARCHAR(24) NOT NULL COMMENT 'WELCOME_FREE/FOLLOW_REWARD/PAID',
    `ledger_status` VARCHAR(16) NOT NULL COMMENT 'RESERVED/CONSUMED/RELEASED',
    `active_entitlement_key` VARCHAR(96) NULL COMMENT '未释放权益的全局唯一键',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_resume_review_ledger_request` (`request_id`),
    UNIQUE KEY `uk_resume_review_ledger_entitlement` (`active_entitlement_key`),
    KEY `idx_resume_review_ledger_user` (`user_id`, `created_at`),
    CONSTRAINT `fk_resume_review_ledger_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`),
    CONSTRAINT `fk_resume_review_ledger_request` FOREIGN KEY (`request_id`) REFERENCES `resume_review_request` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='人工精修额度预留、核销与返还账本';

CREATE TABLE `resume_review_mail_outbox` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `request_id` BIGINT NOT NULL,
    `message_id` VARCHAR(255) NOT NULL COMMENT '固定 Message-ID，重试不变',
    `outbox_status` VARCHAR(16) NOT NULL COMMENT 'PENDING/SENDING/SENT/FAILED',
    `attempt_count` INT NOT NULL DEFAULT 0,
    `next_attempt_at` DATETIME NOT NULL,
    `last_error_type` VARCHAR(128) NULL,
    `sent_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_resume_review_outbox_request` (`request_id`),
    UNIQUE KEY `uk_resume_review_outbox_message` (`message_id`),
    KEY `idx_resume_review_outbox_due` (`outbox_status`, `next_attempt_at`),
    CONSTRAINT `fk_resume_review_outbox_request` FOREIGN KEY (`request_id`) REFERENCES `resume_review_request` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='人工精修邮件可重试 outbox';

CREATE TABLE `resume_review_audit_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `request_id` BIGINT NULL,
    `request_no` VARCHAR(64) NULL,
    `actor_user_id` BIGINT NULL,
    `actor_type` VARCHAR(16) NOT NULL COMMENT 'USER/ADMIN/SYSTEM/BRIDGE',
    `action` VARCHAR(32) NOT NULL,
    `from_status` VARCHAR(24) NULL,
    `to_status` VARCHAR(24) NULL,
    `reason` VARCHAR(500) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_resume_review_audit_request` (`request_id`, `created_at`),
    KEY `idx_resume_review_audit_actor` (`actor_user_id`, `created_at`),
    CONSTRAINT `fk_resume_review_audit_request` FOREIGN KEY (`request_id`) REFERENCES `resume_review_request` (`id`),
    CONSTRAINT `fk_resume_review_audit_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='人工精修全链路审计';
