CREATE TABLE IF NOT EXISTS `user_resume_profile` (
    `user_id` BIGINT NOT NULL COMMENT '用户 ID，一名用户一份常用资料',
    `content` JSON NOT NULL COMMENT '基本信息与可选信息 JSON',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户私有常用简历资料';

CREATE TABLE IF NOT EXISTS `user_resume_material` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `user_id` BIGINT NOT NULL COMMENT '所属用户 ID',
    `module_type` VARCHAR(32) NOT NULL COMMENT '简历模块类型',
    `title` VARCHAR(128) NOT NULL COMMENT '用户自定义素材名称',
    `content` JSON NOT NULL COMMENT '与 resume_module 一致的内容 JSON',
    `tags` JSON NULL COMMENT '用户自定义标签',
    `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/ARCHIVED',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_user_material_owner_type` (`user_id`, `module_type`, `updated_at`),
    KEY `idx_user_material_owner_status` (`user_id`, `status`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户私有简历模块资料库';

CREATE TABLE IF NOT EXISTS `official_resume_material` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `module_type` VARCHAR(32) NOT NULL COMMENT '简历模块类型',
    `title` VARCHAR(128) NOT NULL COMMENT '官方素材标题',
    `target_role` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '适用岗位',
    `career_stage` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '校招/社招等阶段',
    `content` JSON NOT NULL COMMENT '与 resume_module 一致的参考内容 JSON',
    `tags` JSON NULL COMMENT '行业、技术栈等标签',
    `status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/PUBLISHED/ARCHIVED',
    `source_type` VARCHAR(16) NOT NULL DEFAULT 'MANUAL' COMMENT 'MANUAL/AI',
    `version` INT NOT NULL DEFAULT 1 COMMENT '发布内容版本',
    `use_count` BIGINT NOT NULL DEFAULT 0 COMMENT '真实引用次数',
    `created_by` BIGINT NOT NULL COMMENT '创建管理员 ID',
    `updated_by` BIGINT NOT NULL COMMENT '最近更新管理员 ID',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_official_material_public` (`status`, `module_type`, `updated_at`),
    KEY `idx_official_material_role` (`target_role`, `career_stage`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='官方简历参考素材库';

CREATE TABLE IF NOT EXISTS `resume_content_template` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `title` VARCHAR(128) NOT NULL COMMENT '内容模板名称',
    `summary` VARCHAR(512) NOT NULL DEFAULT '' COMMENT '模板适用说明',
    `target_role` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '适用岗位',
    `career_stage` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '适用求职阶段',
    `layout_template_id` VARCHAR(64) NOT NULL DEFAULT 'default' COMMENT '默认版式模板',
    `modules` JSON NOT NULL COMMENT '模块快照数组，不与官方素材实时关联',
    `tags` JSON NULL COMMENT '筛选标签',
    `status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/PUBLISHED/ARCHIVED',
    `source_type` VARCHAR(16) NOT NULL DEFAULT 'MANUAL' COMMENT 'MANUAL/AI',
    `version` INT NOT NULL DEFAULT 1 COMMENT '模板版本',
    `use_count` BIGINT NOT NULL DEFAULT 0 COMMENT '真实创建次数',
    `created_by` BIGINT NOT NULL COMMENT '创建管理员 ID',
    `updated_by` BIGINT NOT NULL COMMENT '最近更新管理员 ID',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_content_template_public` (`status`, `updated_at`),
    KEY `idx_content_template_role` (`target_role`, `career_stage`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='官方简历内容模板';

CREATE TABLE IF NOT EXISTS `resume_material_usage` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    `user_id` BIGINT NOT NULL COMMENT '使用用户 ID',
    `source_type` VARCHAR(24) NOT NULL COMMENT 'OFFICIAL_MATERIAL/CONTENT_TEMPLATE',
    `source_id` BIGINT NOT NULL COMMENT '来源记录 ID',
    `action` VARCHAR(24) NOT NULL COMMENT 'APPLY/CREATE_RESUME',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发生时间',
    PRIMARY KEY (`id`),
    KEY `idx_material_usage_source` (`source_type`, `source_id`, `created_at`),
    KEY `idx_material_usage_user` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='官方资料真实使用事件';
