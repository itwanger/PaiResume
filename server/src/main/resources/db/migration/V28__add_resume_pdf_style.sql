ALTER TABLE `resume`
    ADD COLUMN `pdf_density` VARCHAR(16) NOT NULL DEFAULT 'normal' COMMENT 'PDF 内容密度' AFTER `template_id`,
    ADD COLUMN `accent_preset` VARCHAR(16) NOT NULL DEFAULT 'auto' COMMENT 'PDF 主色预设' AFTER `pdf_density`,
    ADD COLUMN `heading_style` VARCHAR(16) NOT NULL DEFAULT 'auto' COMMENT 'PDF 标题样式' AFTER `accent_preset`;
