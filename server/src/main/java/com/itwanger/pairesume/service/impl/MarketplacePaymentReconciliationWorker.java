package com.itwanger.pairesume.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MarketplacePaymentReconciliationWorker {
    private final MarketplaceOrderServiceImpl marketplaceOrderService;

    @Scheduled(
            initialDelayString = "${app.payment.reconciliation-initial-delay-ms:15000}",
            fixedDelayString = "${app.payment.reconciliation-delay-ms:10000}"
    )
    public void reconcileOrdinaryOpenOrders() {
        try {
            marketplaceOrderService.reconcileOpenOrdersBatch();
        } catch (RuntimeException exception) {
            log.warn("Marketplace open-order reconciliation batch deferred errorType={}",
                    exception.getClass().getSimpleName());
        }
    }

    @Scheduled(
            initialDelayString = "${app.payment.paid-reconciliation-initial-delay-ms:20000}",
            fixedDelayString = "${app.payment.paid-reconciliation-scan-delay-ms:60000}"
    )
    public void reconcilePaidOrdersBeforeEarningRelease() {
        try {
            marketplaceOrderService.reconcileHoldingPaidOrdersBatch();
        } catch (RuntimeException exception) {
            log.warn("Marketplace paid-order reconciliation batch deferred errorType={}",
                    exception.getClass().getSimpleName());
        }
    }
}
