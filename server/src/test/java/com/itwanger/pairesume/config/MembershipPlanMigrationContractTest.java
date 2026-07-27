package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;

class MembershipPlanMigrationContractTest {

    @Test
    void v25SeedsOnlyAnnualFromExistingPriceAndBackfillsOrdersSafely() throws Exception {
        var resource = new ClassPathResource(
                "db/migration/V25__create_membership_plan.sql"
        );
        String sql;
        try (var input = resource.getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertTrue(sql.contains("('MONTHLY', '月卡', 'FIXED_DAYS', 30, NULL, 0"));
        assertTrue(sql.contains("('QUARTERLY', '季卡', 'FIXED_DAYS', 90, NULL, 0"));
        assertTrue(sql.contains("('LIFETIME', '终身会员', 'PERMANENT', NULL, NULL, 0"));
        assertTrue(sql.contains("CASE WHEN `membership_price_cents` > 0"));
        assertTrue(sql.contains("ELSE 'LEGACY_FIXED_DAYS'"));
        assertTrue(sql.contains("MODIFY COLUMN `membership_days` INT NULL"));
        assertTrue(sql.contains(
                "MODIFY COLUMN `plan_code` VARCHAR(32) NOT NULL DEFAULT 'ANNUAL'"));
        assertTrue(sql.contains(
                "MODIFY COLUMN `plan_name_snapshot` VARCHAR(64) NOT NULL DEFAULT '年卡'"));
        assertTrue(sql.contains(
                "MODIFY COLUMN `entitlement_type` VARCHAR(16) NOT NULL DEFAULT 'FIXED_DAYS'"));
        assertTrue(sql.contains("默认值仅用于兼容回滚到旧版应用"));
    }
}
