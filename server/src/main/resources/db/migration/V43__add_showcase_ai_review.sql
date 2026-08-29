ALTER TABLE `resume_showcase`
    ADD COLUMN `ai_review` JSON NULL
        COMMENT '精选时生成并固化的结构化 AI 点评' AFTER `summary`;
