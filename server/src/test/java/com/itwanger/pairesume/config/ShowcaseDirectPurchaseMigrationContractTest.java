package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ShowcaseDirectPurchaseMigrationContractTest {

    @Test
    void v34AddsAdminPriceAndAnonymousSingleResumeOrder() throws Exception {
        var resource = new ClassPathResource(
                "db/migration/V34__add_showcase_direct_purchase.sql"
        );
        String sql;
        try (var input = resource.getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertTrue(sql.contains("ADD COLUMN `price_cents`"));
        assertTrue(sql.contains("SET `access_type` = 'PAID'"));
        assertTrue(sql.contains("WHERE `slug` = 'featured-65'"));
        assertTrue(sql.contains("CREATE TABLE `showcase_purchase_order`"));
        assertTrue(sql.contains("`purchase_token_hash` CHAR(64)"));
        assertTrue(sql.contains("`amount_cents` INT NOT NULL"));
        assertTrue(sql.contains("uk_showcase_purchase_idempotency"));
    }
}
