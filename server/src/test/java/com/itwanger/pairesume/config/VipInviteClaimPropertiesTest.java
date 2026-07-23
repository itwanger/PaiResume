package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class VipInviteClaimPropertiesTest {

    @Test
    void defaultsAreAcceptedAtStartup() {
        assertDoesNotThrow(new VipInviteClaimProperties()::validateAtStartup);
    }

    @Test
    void unsafeLifecycleConfigurationFailsStartupValidation() {
        VipInviteClaimProperties invalidTtl = new VipInviteClaimProperties();
        invalidTtl.setTtlSeconds(60);
        assertThrows(IllegalStateException.class, invalidTtl::validateAtStartup);

        VipInviteClaimProperties invalidRetention = new VipInviteClaimProperties();
        invalidRetention.setRetentionDays(0);
        assertThrows(IllegalStateException.class, invalidRetention::validateAtStartup);

        VipInviteClaimProperties invalidBatch = new VipInviteClaimProperties();
        invalidBatch.setCleanupBatchSize(5001);
        assertThrows(IllegalStateException.class, invalidBatch::validateAtStartup);

        VipInviteClaimProperties invalidSchedule = new VipInviteClaimProperties();
        invalidSchedule.setCleanupIntervalMs(59999);
        assertThrows(IllegalStateException.class, invalidSchedule::validateAtStartup);
    }
}
