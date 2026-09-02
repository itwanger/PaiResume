ALTER TABLE `resume`
    MODIFY COLUMN `template_id` VARCHAR(64) DEFAULT 'focus' COMMENT '模板标识',
    MODIFY COLUMN `page_mode` VARCHAR(16) NOT NULL DEFAULT 'continuous' COMMENT 'PDF 页面模式',
    MODIFY COLUMN `pdf_density` VARCHAR(16) NOT NULL DEFAULT 'compact' COMMENT 'PDF 内容密度';
