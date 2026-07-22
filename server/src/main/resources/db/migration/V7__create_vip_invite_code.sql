CREATE TABLE IF NOT EXISTS `vip_invite_code` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `code` VARCHAR(64) NOT NULL COMMENT 'VIP 邀请码',
    `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE/EXHAUSTED/INVALID',
    `remark` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '管理员备注',
    `created_by` BIGINT NOT NULL COMMENT '创建管理员 ID',
    `max_redemptions` INT NOT NULL DEFAULT 100 COMMENT '最大兑换人数',
    `redeemed_count` INT NOT NULL DEFAULT 0 COMMENT '已兑换人数',
    `membership_days` INT NOT NULL DEFAULT 30 COMMENT '每次兑换赠送会员天数',
    `expires_at` DATETIME NULL COMMENT '过期时间，为空表示永不过期',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_vip_invite_code` (`code`),
    KEY `idx_vip_invite_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='VIP 邀请码表';

CREATE TABLE IF NOT EXISTS `vip_invite_redemption` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `invite_code_id` BIGINT NOT NULL COMMENT '邀请码 ID',
    `user_id` BIGINT NOT NULL COMMENT '兑换用户 ID',
    `membership_started_at` DATETIME NOT NULL COMMENT '会员开始时间',
    `membership_expires_at` DATETIME NOT NULL COMMENT '会员到期时间',
    `redeemed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '兑换时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_vip_invite_redemption_user` (`user_id`),
    UNIQUE KEY `uk_vip_invite_redemption_pair` (`invite_code_id`, `user_id`),
    KEY `idx_vip_invite_redemption_code` (`invite_code_id`, `redeemed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='VIP 邀请码兑换记录表';
