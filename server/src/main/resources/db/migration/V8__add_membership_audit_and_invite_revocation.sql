ALTER TABLE `user`
    ADD COLUMN `membership_origin_type` VARCHAR(32) NULL COMMENT '当前会员权益根来源: VIP_INVITE/ADMIN_GRANTED/ADMIN_EXTENDED/PAYMENT' AFTER `membership_source`,
    ADD COLUMN `membership_origin_id` BIGINT NULL COMMENT '当前会员权益根来源记录 ID' AFTER `membership_origin_type`;

ALTER TABLE `vip_invite_code`
    ADD COLUMN `invalidated_by` BIGINT NULL COMMENT '作废管理员 ID' AFTER `expires_at`,
    ADD COLUMN `invalidated_at` DATETIME NULL COMMENT '作废时间' AFTER `invalidated_by`,
    ADD COLUMN `invalidate_reason` VARCHAR(255) NULL COMMENT '作废原因' AFTER `invalidated_at`;

ALTER TABLE `vip_invite_redemption`
    ADD COLUMN `redemption_status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '权益状态: ACTIVE/REVOKED' AFTER `membership_expires_at`,
    ADD COLUMN `revoked_by` BIGINT NULL COMMENT '撤销管理员 ID' AFTER `redemption_status`,
    ADD COLUMN `revoked_at` DATETIME NULL COMMENT '撤销时间' AFTER `revoked_by`,
    ADD COLUMN `revoke_reason` VARCHAR(255) NULL COMMENT '撤销原因' AFTER `revoked_at`,
    ADD KEY `idx_vip_invite_redemption_status` (`invite_code_id`, `redemption_status`, `redeemed_at`);

UPDATE `user` u
JOIN `vip_invite_redemption` r ON r.`user_id` = u.`id`
SET u.`membership_origin_type` = 'VIP_INVITE',
    u.`membership_origin_id` = r.`id`
WHERE u.`membership_origin_type` IS NULL
  AND u.`membership_source` IN ('VIP_INVITE', 'ADMIN_EXTENDED');

CREATE TABLE IF NOT EXISTS `membership_admin_audit_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `admin_user_id` BIGINT NOT NULL COMMENT '操作管理员 ID',
    `action` VARCHAR(40) NOT NULL COMMENT '操作类型',
    `target_user_id` BIGINT NULL COMMENT '目标用户 ID',
    `invite_code_id` BIGINT NULL COMMENT '邀请码 ID',
    `redemption_id` BIGINT NULL COMMENT '邀请码兑换记录 ID',
    `reason` VARCHAR(255) NOT NULL COMMENT '操作原因',
    `before_membership_status` VARCHAR(16) NULL COMMENT '操作前会员状态',
    `before_membership_source` VARCHAR(32) NULL COMMENT '操作前会员来源',
    `before_membership_expires_at` DATETIME NULL COMMENT '操作前到期时间',
    `after_membership_status` VARCHAR(16) NULL COMMENT '操作后会员状态',
    `after_membership_source` VARCHAR(32) NULL COMMENT '操作后会员来源',
    `after_membership_expires_at` DATETIME NULL COMMENT '操作后到期时间',
    `details` TEXT NULL COMMENT '补充详情',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    PRIMARY KEY (`id`),
    KEY `idx_membership_audit_admin` (`admin_user_id`, `created_at`),
    KEY `idx_membership_audit_user` (`target_user_id`, `created_at`),
    KEY `idx_membership_audit_invite` (`invite_code_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员管理员操作审计日志';
