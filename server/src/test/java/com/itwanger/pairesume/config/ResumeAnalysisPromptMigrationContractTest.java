package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ResumeAnalysisPromptMigrationContractTest {
    @Test
    void v30CreatesFourScenarioPromptsAndPersistsScenarioOnRecords() throws Exception {
        var resource = new ClassPathResource("db/migration/V30__create_resume_analysis_prompt_config.sql");
        String sql;
        try (var input = resource.getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS `resume_analysis_prompt_config`"));
        assertTrue(sql.contains("'WORKING_PROFESSIONAL', '工作党'"));
        assertTrue(sql.contains("工作党不要求实习经历"));
        assertTrue(sql.contains("'STUDENT_DAILY_INTERNSHIP', '学生党找日常实习'"));
        assertTrue(sql.contains("'STUDENT_SUMMER_INTERNSHIP', '学生党找暑期实习'"));
        assertTrue(sql.contains("'STUDENT_AUTUMN_RECRUITMENT', '学生党冲秋招'"));
        assertTrue(sql.contains("ADD COLUMN `scenario_code` VARCHAR(64) NULL"));
    }
}
