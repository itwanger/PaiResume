package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ShowcaseContentTagsRemovalMigrationContractTest {

    @Test
    void v32DropsAiGeneratedContentTagsFromOfficialShowcases() throws Exception {
        var resource = new ClassPathResource(
                "db/migration/V32__remove_showcase_content_tags.sql"
        );
        String sql;
        try (var input = resource.getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertTrue(sql.contains("ALTER TABLE `resume_showcase`"));
        assertTrue(sql.contains("DROP COLUMN `tags`"));
    }
}
