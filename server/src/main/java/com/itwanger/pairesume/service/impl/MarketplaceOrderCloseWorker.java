package com.itwanger.pairesume.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MarketplaceOrderCloseWorker {
    private final MarketplaceOrderServiceImpl marketplaceOrderService;

    @Scheduled(
            initialDelayString = "${app.payment.close-worker-initial-delay-ms:5000}",
            fixedDelayString = "${app.payment.close-worker-delay-ms:5000}"
    )
    public void closeInvalidatedSaleOrders() {
        try {
            marketplaceOrderService.closeSaleClosedOrdersBatch();
        } catch (RuntimeException exception) {
            log.warn("Marketplace stale-order close batch deferred errorType={}",
                    exception.getClass().getSimpleName());
        }
    }
}
