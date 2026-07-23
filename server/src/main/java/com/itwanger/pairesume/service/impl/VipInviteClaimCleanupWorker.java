package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.config.VipInviteClaimProperties;
import com.itwanger.pairesume.mapper.VipInviteClaimMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class VipInviteClaimCleanupWorker {

    private final VipInviteClaimMapper claimMapper;
    private final VipInviteClaimProperties properties;

    @Scheduled(
            initialDelayString = "${app.vip-invite-claim.cleanup-initial-delay-ms:60000}",
            fixedDelayString = "${app.vip-invite-claim.cleanup-interval-ms:3600000}"
    )
    public void maintainClaims() {
        try {
            LocalDateTime now = LocalDateTime.now();
            int batchSize = properties.requireValidCleanupBatchSize();
            int expired = claimMapper.expirePendingBatch(now, batchSize);
            LocalDateTime cutoff = now.minusDays(properties.requireValidRetentionDays());
            int deleted = claimMapper.deleteTerminalBatch(cutoff, batchSize);
            if (expired > 0 || deleted > 0) {
                log.info("VIP invite claim maintenance completed expired={} deleted={}",
                        expired, deleted);
            }
        } catch (RuntimeException exception) {
            log.warn("VIP invite claim maintenance deferred errorType={}",
                    exception.getClass().getSimpleName());
        }
    }
}
