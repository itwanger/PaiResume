package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ShowcaseAccessTypeMigrationContractTest {

    @Test
    void v24KeepsExistingShowcasesVipUntilAdminMakesThemPublic() throws Exception {
        var resource = new ClassPathResource(
                "db/migration/V24__add_showcase_access_type.sql"
        );
        String sql;
        try (var input = resource.getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertTrue(sql.contains("ADD COLUMN `access_type` VARCHAR(16) NOT NULL DEFAULT 'VIP'"));
        assertTrue(sql.contains("访问类型: FREE/VIP"));
    }
}
