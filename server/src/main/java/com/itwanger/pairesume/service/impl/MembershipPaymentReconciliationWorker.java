package com.itwanger.pairesume.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MembershipPaymentReconciliationWorker {
    private final MembershipOrderServiceImpl membershipOrderService;

    @Scheduled(
            initialDelayString = "${app.payment.membership-reconciliation-initial-delay-ms:17000}",
            fixedDelayString = "${app.payment.membership-reconciliation-delay-ms:10000}"
    )
    public void reconcileOpenOrders() {
        try {
            membershipOrderService.reconcileOpenOrdersBatch();
        } catch (RuntimeException exception) {
            membershipOrderService.recordReconciliationFailure(null, exception);
        }
    }
}
