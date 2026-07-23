package com.itwanger.pairesume.config;

import jakarta.annotation.PostConstruct;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.vip-invite-claim")
public class VipInviteClaimProperties {
    private int ttlSeconds = 600;
    private int retentionDays = 30;
    private int cleanupBatchSize = 500;
    private long cleanupInitialDelayMs = 60000;
    private long cleanupIntervalMs = 3600000;

    public int requireValidTtlSeconds() {
        if (ttlSeconds < 300 || ttlSeconds > 1800) {
            throw new IllegalStateException("VIP invite claim TTL must be between 300 and 1800 seconds");
        }
        return ttlSeconds;
    }

    public int requireValidRetentionDays() {
        if (retentionDays < 1 || retentionDays > 3650) {
            throw new IllegalStateException("VIP invite claim retention must be between 1 and 3650 days");
        }
        return retentionDays;
    }

    public int requireValidCleanupBatchSize() {
        if (cleanupBatchSize < 1 || cleanupBatchSize > 5000) {
            throw new IllegalStateException("VIP invite claim cleanup batch size must be between 1 and 5000");
        }
        return cleanupBatchSize;
    }

    public void requireValidCleanupSchedule() {
        if (cleanupInitialDelayMs < 0 || cleanupInitialDelayMs > 3600000) {
            throw new IllegalStateException(
                    "VIP invite claim cleanup initial delay must be between 0 and 3600000 ms"
            );
        }
        if (cleanupIntervalMs < 60000 || cleanupIntervalMs > 86400000) {
            throw new IllegalStateException(
                    "VIP invite claim cleanup interval must be between 60000 and 86400000 ms"
            );
        }
    }

    @PostConstruct
    public void validateAtStartup() {
        requireValidTtlSeconds();
        requireValidRetentionDays();
        requireValidCleanupBatchSize();
        requireValidCleanupSchedule();
    }
}
