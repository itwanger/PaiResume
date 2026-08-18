CREATE TABLE IF NOT EXISTS `resume_analysis_prompt_config` (
    `scenario_code` VARCHAR(64) NOT NULL COMMENT '稳定求职场景编码',
    `display_name` VARCHAR(64) NOT NULL COMMENT '用户端场景名称',
    `prompt` TEXT NOT NULL COMMENT '管理员维护的场景分析提示词',
    `sort_order` INT NOT NULL DEFAULT 0 COMMENT '展示顺序',
    `updated_by` BIGINT NULL COMMENT '最后更新管理员',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`scenario_code`),
    KEY `idx_resume_analysis_prompt_sort` (`sort_order`, `scenario_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分求职场景的简历分析提示词配置';

INSERT INTO `resume_analysis_prompt_config` (`scenario_code`, `display_name`, `prompt`, `sort_order`)
VALUES
    ('WORKING_PROFESSIONAL', '工作党', '请按有工作经验的社会招聘简历标准评估。\n\n核心评估范围：\n1. 基本信息是否准确、求职方向是否清晰。\n2. 工作经历是否写清公司、职位、任职时间，以及候选人在项目中的职责边界、技术决策和可验证成果。\n3. 专业技能是否与目标岗位和工作项目相互印证。\n4. 教育背景只作为基础信息评估，不因学校层级或缺少 GPA 明显扣分。\n\n场景边界：\n1. 工作党不要求实习经历，不得因缺少或填写实习经历单独加分或扣分。\n2. 不要求论文期刊、科研经历和独立项目经历；工作项目已经写在工作经历中时，不得要求重复新增项目经历。\n3. 重点检查工作内容是否只有技术堆砌、缺少本人贡献、业务价值或量化结果。\n4. 已具备清晰工作时间线、真实项目成果和岗位匹配能力的简历，应得到与成熟度相符的高分。', 10),
    ('STUDENT_DAILY_INTERNSHIP', '学生党找日常实习', '请按学生申请日常实习的技术简历标准评估。\n\n核心评估范围：\n1. 基本信息、教育背景、专业技能、项目经历是主要评分依据。\n2. 项目经历重点看候选人实际承担的工作、使用的技术、解决的问题和可验证成果。\n3. 荣誉奖项、科研经历、论文期刊只在与目标岗位相关且确有内容时作为补充，不要求本科生必须具备。\n4. 不要求正式工作经历，也不得因缺少工作经历扣分。\n5. 对研究生简历，可结合已有科研或论文判断研究能力，但不得因未填写而机械扣分。', 20),
    ('STUDENT_SUMMER_INTERNSHIP', '学生党找暑期实习', '请按学生申请暑期实习的技术简历标准评估。\n\n核心评估范围：\n1. 基本信息、教育背景、专业技能、项目经历是主要评分依据。\n2. 更关注项目完整度、技术深度、本人职责、成果数据以及与目标岗位的匹配度。\n3. 已有实习经历时重点评估实际贡献；没有实习经历时，不得仅因这一点直接判定简历不合格。\n4. 荣誉奖项可作为竞争力补充；科研经历和论文期刊仅对研究生或研究型岗位按相关性评估。\n5. 不要求正式工作经历，也不得因缺少工作经历扣分。', 30),
    ('STUDENT_AUTUMN_RECRUITMENT', '学生党冲秋招', '请按应届生参加秋季招聘的技术简历标准评估。\n\n核心评估范围：\n1. 基本信息、教育背景、专业技能、实习经历和项目经历共同构成主要评分依据。\n2. 有实习经历时重点看真实职责和成果；没有实习经历时，应结合项目、科研和竞赛等现有内容判断岗位准备度，不能机械扣分。\n3. 项目经历重点检查技术深度、本人贡献、问题难度、结果表达和岗位匹配度。\n4. 荣誉奖项用于补充竞争力；科研经历和论文期刊仅在研究生或研究型岗位下按相关性评估。\n5. 不要求正式工作经历，也不得因缺少工作经历扣分。', 40)
ON DUPLICATE KEY UPDATE `scenario_code` = `scenario_code`;

ALTER TABLE `resume_analysis_record`
    ADD COLUMN `scenario_code` VARCHAR(64) NULL COMMENT '本次分析使用的求职场景' AFTER `resume_id`,
    ADD KEY `idx_resume_analysis_scenario` (`scenario_code`, `created_at`);
