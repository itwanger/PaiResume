package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ShowcaseAccessRefinementMigrationContractTest {

    @Test
    void v33DefinesPublicLoginAndPaidAccessWithoutVipNaming() throws Exception {
        var resource = new ClassPathResource(
                "db/migration/V33__refine_showcase_access_types.sql"
        );
        String sql;
        try (var input = resource.getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertTrue(sql.contains("WHEN UPPER(TRIM(`access_type`)) = 'FREE' THEN 'PUBLIC'"));
        assertTrue(sql.contains("WHEN UPPER(TRIM(`access_type`)) = 'VIP' THEN 'PAID'"));
        assertTrue(sql.contains("WHERE `slug` = 'featured-65'"));
        assertTrue(sql.contains("DEFAULT 'PUBLIC'"));
        assertTrue(sql.contains("访问类型: PUBLIC/LOGIN/PAID"));
    }
}
