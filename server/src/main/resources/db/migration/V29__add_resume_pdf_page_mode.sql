ALTER TABLE `resume`
    ADD COLUMN `page_mode` VARCHAR(16) NOT NULL DEFAULT 'standard' COMMENT 'PDF 页面模式' AFTER `template_id`;
