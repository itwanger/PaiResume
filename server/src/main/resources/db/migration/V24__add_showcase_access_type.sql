ALTER TABLE `resume_showcase`
    ADD COLUMN `access_type` VARCHAR(16) NOT NULL DEFAULT 'VIP'
        COMMENT '访问类型: FREE/VIP' AFTER `publish_status`;
