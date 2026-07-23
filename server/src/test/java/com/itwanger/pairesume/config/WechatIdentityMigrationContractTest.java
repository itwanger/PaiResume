package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;

class WechatIdentityMigrationContractTest {

    @Test
    void v19SupportsTrueQrOnlyAccountsAndTrustedSubscriptionState() throws Exception {
        var resource = new ClassPathResource(
                "db/migration/V19__add_paicongming_wechat_identity.sql"
        );
        String sql;
        try (var input = resource.getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertTrue(sql.contains("`email` VARCHAR(128) NULL"));
        assertTrue(sql.contains("`password` VARCHAR(255) NULL"));
        assertTrue(sql.contains("`subscribed` TINYINT NOT NULL DEFAULT 0"));
        assertTrue(sql.contains("`subscription_updated_at` DATETIME NULL"));
    }
}
