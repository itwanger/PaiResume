ALTER TABLE `user`
    ADD COLUMN `terms_accepted_at` DATETIME NULL COMMENT '最近一次同意服务条款时间' AFTER `membership_expires_at`,
    ADD COLUMN `privacy_accepted_at` DATETIME NULL COMMENT '最近一次同意隐私政策时间' AFTER `terms_accepted_at`,
    ADD COLUMN `terms_version` VARCHAR(32) NULL COMMENT '已同意服务条款版本' AFTER `privacy_accepted_at`,
    ADD COLUMN `privacy_version` VARCHAR(32) NULL COMMENT '已同意隐私政策版本' AFTER `terms_version`,
    ADD COLUMN `ai_processing_disclosure_version` VARCHAR(32) NULL COMMENT '已知悉第三方 AI 处理说明版本' AFTER `privacy_version`,
    ADD COLUMN `account_deleted_at` DATETIME NULL COMMENT '账号注销时间' AFTER `ai_processing_disclosure_version`;

CREATE INDEX `idx_user_account_deleted_at` ON `user` (`account_deleted_at`);
