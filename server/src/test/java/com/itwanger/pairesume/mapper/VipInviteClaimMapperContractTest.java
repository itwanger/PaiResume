package com.itwanger.pairesume.mapper;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Update;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VipInviteClaimMapperContractTest {

    @Test
    void maintenanceSqlExpiresOnlyPendingClaimsAndNeverDeletesRedeemedClaims() throws Exception {
        Update expire = VipInviteClaimMapper.class
                .getMethod("expirePendingBatch", LocalDateTime.class, int.class)
                .getAnnotation(Update.class);
        String expireSql = String.join(" ", expire.value());
        assertTrue(expireSql.contains("'AWAITING_IDENTITY'"));
        assertTrue(expireSql.contains("'PENDING_CONSENT'"));
        assertTrue(expireSql.contains("'PENDING_REDEMPTION'"));
        assertTrue(expireSql.contains("expires_at <= #{now}"));
        assertTrue(expireSql.contains("LIMIT #{batchSize}"));

        Delete cleanup = VipInviteClaimMapper.class
                .getMethod("deleteTerminalBatch", LocalDateTime.class, int.class)
                .getAnnotation(Delete.class);
        String cleanupSql = String.join(" ", cleanup.value());
        assertTrue(cleanupSql.contains("status IN ('EXPIRED', 'FAILED')"));
        assertTrue(cleanupSql.contains("updated_at < #{cutoff}"));
        assertTrue(cleanupSql.contains("LIMIT #{batchSize}"));
        assertFalse(cleanupSql.contains("REDEEMED"));
    }
}
