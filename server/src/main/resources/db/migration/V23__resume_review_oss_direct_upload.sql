ALTER TABLE `resume_review_request`
    ADD COLUMN `pdf_object_key` VARCHAR(512) NULL COMMENT '服务端固化的私有 OSS 对象键' AFTER `content_hash`,
    ADD COLUMN `pdf_object_etag` VARCHAR(128) NULL COMMENT '固化对象的 OSS ETag' AFTER `pdf_object_key`,
    ADD COLUMN `pdf_original_file_name` VARCHAR(200) NULL COMMENT '用户选择的原始 PDF 文件名' AFTER `pdf_object_etag`,
    ADD COLUMN `pdf_size_bytes` BIGINT NULL COMMENT '固化 PDF 字节数' AFTER `pdf_original_file_name`,
    ADD COLUMN `pdf_sha256` CHAR(64) NULL COMMENT '浏览器计算并在邮件投递前复核的 SHA-256' AFTER `pdf_size_bytes`,
    ADD COLUMN `pdf_uploaded_at` DATETIME NULL COMMENT 'OSS 固化完成时间' AFTER `pdf_sha256`,
    ADD KEY `idx_resume_review_pdf_object` (`pdf_object_key`);

CREATE TABLE `resume_review_upload` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `upload_no` VARCHAR(64) NOT NULL COMMENT 'RU 前缀的上传票据号',
    `user_id` BIGINT NOT NULL,
    `resume_id` BIGINT NOT NULL,
    `active_user_key` VARCHAR(64) NULL COMMENT '同一用户至多一个待完成或 READY 上传',
    `staging_object_key` VARCHAR(512) NOT NULL COMMENT '浏览器 POST Policy 直传的临时对象键',
    `final_object_key` VARCHAR(512) NOT NULL COMMENT '服务端 OSS 内复制固化后的对象键',
    `original_file_name` VARCHAR(200) NOT NULL,
    `size_bytes` BIGINT NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `object_etag` VARCHAR(128) NULL,
    `upload_status` VARCHAR(24) NOT NULL COMMENT 'PENDING/READY/CONSUMED/EXPIRED/REJECTED',
    `expires_at` DATETIME NOT NULL,
    `consumed_request_id` BIGINT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_resume_review_upload_no` (`upload_no`),
    UNIQUE KEY `uk_resume_review_upload_active_user` (`active_user_key`),
    KEY `idx_resume_review_upload_user` (`user_id`, `created_at`),
    KEY `idx_resume_review_upload_expiry` (`upload_status`, `expires_at`),
    CONSTRAINT `fk_resume_review_upload_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`),
    CONSTRAINT `fk_resume_review_upload_resume`
        FOREIGN KEY (`resume_id`) REFERENCES `resume` (`id`),
    CONSTRAINT `fk_resume_review_upload_request`
        FOREIGN KEY (`consumed_request_id`) REFERENCES `resume_review_request` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='人工精修 PDF 私有 OSS 直传票据';
