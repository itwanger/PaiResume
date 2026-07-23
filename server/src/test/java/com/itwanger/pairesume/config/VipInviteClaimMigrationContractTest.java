package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VipInviteClaimMigrationContractTest {

    @Test
    void v21PersistsOnlyOpaqueClaimAndInviteReferencesWithImmutableBindings() throws Exception {
        var resource = new ClassPathResource(
                "db/migration/V21__add_vip_invite_claim.sql"
        );
        String sql;
        try (var input = resource.getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertTrue(sql.contains("`token_hash` CHAR(64) NOT NULL"));
        assertTrue(sql.contains("`invite_code_id` BIGINT NOT NULL"));
        assertTrue(sql.contains("`challenge_id_hash` CHAR(64) NULL"));
        assertTrue(sql.contains("`user_id` BIGINT NULL"));
        assertTrue(sql.contains("`redemption_id` BIGINT NULL"));
        assertTrue(sql.contains("AWAITING_IDENTITY/PENDING_CONSENT/PENDING_REDEMPTION/REDEEMED/EXPIRED/FAILED"));
        assertTrue(sql.contains("UNIQUE KEY `uk_vip_invite_claim_token_hash`"));
        assertTrue(sql.contains("UNIQUE KEY `uk_vip_invite_claim_challenge_hash`"));
        assertTrue(sql.contains("KEY `idx_vip_invite_claim_retention` (`status`, `updated_at`)"));
        assertFalse(sql.contains("`code` VARCHAR"));
        assertFalse(sql.contains("`claim_token`"));
    }
}
