package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ResumePdfPageModeMigrationContractTest {
    @Test
    void v29PersistsTheResumePdfPageMode() throws Exception {
        var resource = new ClassPathResource("db/migration/V29__add_resume_pdf_page_mode.sql");
        String sql;
        try (var input = resource.getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertTrue(sql.contains("ADD COLUMN `page_mode` VARCHAR(16) NOT NULL DEFAULT 'standard'"));
    }
}
