ALTER TABLE `resume_review_upload`
    MODIFY COLUMN `resume_id` BIGINT NULL COMMENT '历史站内简历 ID；直接上传导出 PDF 时为空';

ALTER TABLE `resume_review_request`
    MODIFY COLUMN `resume_id` BIGINT NULL COMMENT '历史站内简历 ID；直接上传导出 PDF 时为空',
    ADD COLUMN `dispatched_at` DATETIME NULL COMMENT '用户确认把 PDF 发送至人工精修邮箱的时间' AFTER `paid_at`;

UPDATE `resume_review_request` r
JOIN `resume_review_mail_outbox` o ON o.`request_id` = r.`id`
SET r.`dispatched_at` = COALESCE(o.`created_at`, r.`updated_at`, r.`created_at`)
WHERE r.`dispatched_at` IS NULL;
