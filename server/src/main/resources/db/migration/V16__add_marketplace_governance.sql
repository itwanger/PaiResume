ALTER TABLE `resume_market_listing`
    ADD COLUMN `pending_revision_id` BIGINT NULL COMMENT '等待平台审核的快照版本 ID' AFTER `current_revision_id`,
    ADD COLUMN `review_status` VARCHAR(16) NOT NULL DEFAULT 'APPROVED' COMMENT '投稿审核状态: PENDING/APPROVED/REJECTED' AFTER `moderation_status`,
    ADD COLUMN `review_submitted_at` DATETIME NULL COMMENT '最近一次投稿送审时间' AFTER `review_status`,
    ADD COLUMN `publish_after_review` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '审核通过后是否按作者意愿发布' AFTER `review_submitted_at`,
    ADD KEY `idx_market_listing_review` (`review_status`, `review_submitted_at`);

CREATE TABLE IF NOT EXISTS `marketplace_listing_report` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `listing_id` BIGINT NOT NULL COMMENT '被举报市场条目 ID',
    `report_type` VARCHAR(24) NOT NULL COMMENT '举报类型',
    `description` VARCHAR(1000) NOT NULL COMMENT '举报说明',
    `contact` VARCHAR(255) NULL COMMENT '举报人可选联系方式',
    `reporter_ip_hash` CHAR(64) NOT NULL COMMENT '举报来源 IP 的不可逆摘要',
    `fingerprint` CHAR(64) NOT NULL COMMENT '同内容防重复摘要',
    `processing_status` VARCHAR(16) NOT NULL DEFAULT 'OPEN' COMMENT '处理状态: OPEN/RESOLVED/DISMISSED',
    `handled_by` BIGINT NULL COMMENT '处理管理员 ID',
    `handled_reason` VARCHAR(500) NULL COMMENT '处理原因',
    `handled_at` DATETIME NULL COMMENT '处理时间',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_market_report_queue` (`processing_status`, `created_at`),
    KEY `idx_market_report_listing` (`listing_id`, `created_at`),
    KEY `idx_market_report_ip` (`reporter_ip_hash`, `created_at`),
    KEY `idx_market_report_fingerprint` (`fingerprint`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='简历市场公开举报与侵权投诉';

CREATE TABLE IF NOT EXISTS `marketplace_listing_appeal` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `listing_id` BIGINT NOT NULL COMMENT '申诉市场条目 ID',
    `listing_revision_id` BIGINT NULL COMMENT '申诉所针对的快照版本 ID',
    `creator_user_id` BIGINT NOT NULL COMMENT '申诉创作者 ID',
    `appeal_type` VARCHAR(24) NOT NULL COMMENT '申诉类型: REVIEW_REJECTION/TAKEDOWN',
    `description` VARCHAR(1000) NOT NULL COMMENT '申诉说明',
    `appeal_status` VARCHAR(16) NOT NULL DEFAULT 'OPEN' COMMENT '申诉状态: OPEN/APPROVED/REJECTED',
    `handled_by` BIGINT NULL COMMENT '处理管理员 ID',
    `handled_reason` VARCHAR(500) NULL COMMENT '处理原因',
    `handled_at` DATETIME NULL COMMENT '处理时间',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_market_appeal_queue` (`appeal_status`, `created_at`),
    KEY `idx_market_appeal_listing` (`listing_id`, `created_at`),
    KEY `idx_market_appeal_creator` (`creator_user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='简历市场创作者申诉';

CREATE TABLE IF NOT EXISTS `marketplace_governance_audit` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `listing_id` BIGINT NULL COMMENT '关联市场条目 ID',
    `actor_user_id` BIGINT NULL COMMENT '操作用户 ID，公开举报可为空',
    `actor_type` VARCHAR(16) NOT NULL COMMENT '操作者类型: PUBLIC/CREATOR/ADMIN/SYSTEM',
    `action` VARCHAR(32) NOT NULL COMMENT '治理动作',
    `target_type` VARCHAR(24) NOT NULL COMMENT '目标类型: SUBMISSION/LISTING/REPORT/APPEAL',
    `target_id` BIGINT NULL COMMENT '目标 ID',
    `from_status` VARCHAR(24) NULL COMMENT '操作前状态',
    `to_status` VARCHAR(24) NULL COMMENT '操作后状态',
    `reason` VARCHAR(1000) NULL COMMENT '动作原因或说明',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    KEY `idx_market_audit_listing` (`listing_id`, `created_at`),
    KEY `idx_market_audit_target` (`target_type`, `target_id`, `created_at`),
    KEY `idx_market_audit_actor` (`actor_user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='简历市场治理审计轨迹';
