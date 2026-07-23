package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.config.VipInviteClaimProperties;
import com.itwanger.pairesume.mapper.VipInviteClaimMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VipInviteClaimCleanupWorkerTest {

    @Mock private VipInviteClaimMapper claimMapper;

    @Test
    void marksExpiredInBatchesThenDeletesOnlyAfterTheRetentionWindow() {
        VipInviteClaimProperties properties = new VipInviteClaimProperties();
        properties.setRetentionDays(30);
        properties.setCleanupBatchSize(200);
        when(claimMapper.expirePendingBatch(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq(200)
        )).thenReturn(12);
        when(claimMapper.deleteTerminalBatch(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq(200)
        )).thenReturn(3);
        VipInviteClaimCleanupWorker worker =
                new VipInviteClaimCleanupWorker(claimMapper, properties);
        ArgumentCaptor<LocalDateTime> nowCaptor =
                ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> cutoffCaptor =
                ArgumentCaptor.forClass(LocalDateTime.class);

        worker.maintainClaims();

        verify(claimMapper).expirePendingBatch(nowCaptor.capture(), org.mockito.ArgumentMatchers.eq(200));
        verify(claimMapper).deleteTerminalBatch(cutoffCaptor.capture(), org.mockito.ArgumentMatchers.eq(200));
        long days = Duration.between(cutoffCaptor.getValue(), nowCaptor.getValue()).toDays();
        assertTrue(days == 30 || days == 29);
    }

    @Test
    void transientExpiryFailureIsDeferredWithoutRunningDeletion() {
        VipInviteClaimProperties properties = new VipInviteClaimProperties();
        when(claimMapper.expirePendingBatch(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq(properties.getCleanupBatchSize())
        )).thenThrow(new IllegalStateException("database unavailable"));
        VipInviteClaimCleanupWorker worker =
                new VipInviteClaimCleanupWorker(claimMapper, properties);

        worker.maintainClaims();

        verify(claimMapper, never()).deleteTerminalBatch(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyInt()
        );
    }
}
