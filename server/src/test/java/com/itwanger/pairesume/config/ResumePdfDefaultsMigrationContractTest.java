package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ResumePdfDefaultsMigrationContractTest {
    @Test
    void v44UpdatesDefaultsWithoutOverwritingSavedResumeStyles() throws Exception {
        var resource = new ClassPathResource("db/migration/V44__update_resume_pdf_defaults.sql");
        String sql;
        try (var input = resource.getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertTrue(sql.contains("`template_id` VARCHAR(64) DEFAULT 'focus'"));
        assertTrue(sql.contains("`page_mode` VARCHAR(16) NOT NULL DEFAULT 'continuous'"));
        assertTrue(sql.contains("`pdf_density` VARCHAR(16) NOT NULL DEFAULT 'compact'"));
        assertTrue(!sql.toUpperCase().contains("UPDATE `RESUME`"));
    }
}
