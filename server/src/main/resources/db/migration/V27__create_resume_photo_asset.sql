CREATE TABLE `resume_photo` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `photo_no` VARCHAR(64) NOT NULL COMMENT 'RP 前缀的上传票据号',
    `user_id` BIGINT NOT NULL COMMENT '照片所有者',
    `active_user_key` VARCHAR(64) NULL COMMENT '同一用户至多一个待完成上传',
    `staging_object_key` VARCHAR(512) NOT NULL COMMENT '浏览器直传的私有 OSS 临时对象键',
    `object_key` VARCHAR(512) NOT NULL COMMENT '校验后固化的私有 OSS 对象键',
    `original_file_name` VARCHAR(200) NOT NULL,
    `content_type` VARCHAR(32) NOT NULL COMMENT 'image/png 或 image/jpeg',
    `size_bytes` BIGINT NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `width` INT NOT NULL,
    `height` INT NOT NULL,
    `object_etag` VARCHAR(128) NULL,
    `photo_status` VARCHAR(24) NOT NULL COMMENT 'PENDING/READY/EXPIRED/REJECTED',
    `expires_at` DATETIME NOT NULL COMMENT '上传票据有效期；READY 后仅作审计',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_resume_photo_no` (`photo_no`),
    UNIQUE KEY `uk_resume_photo_active_user` (`active_user_key`),
    KEY `idx_resume_photo_user` (`user_id`, `photo_status`, `created_at`),
    KEY `idx_resume_photo_expiry` (`photo_status`, `expires_at`),
    CONSTRAINT `fk_resume_photo_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='用户私有简历照片 OSS 资产';
