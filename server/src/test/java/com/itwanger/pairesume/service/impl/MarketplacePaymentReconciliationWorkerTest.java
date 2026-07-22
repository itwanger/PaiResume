package com.itwanger.pairesume.service.impl;

import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class MarketplacePaymentReconciliationWorkerTest {
    @Test
    void scheduledPaidTickInvokesHoldPeriodRefundReconciliation() {
        MarketplaceOrderServiceImpl orderService = mock(MarketplaceOrderServiceImpl.class);
        MarketplacePaymentReconciliationWorker worker =
                new MarketplacePaymentReconciliationWorker(orderService);

        worker.reconcilePaidOrdersBeforeEarningRelease();

        verify(orderService).reconcileHoldingPaidOrdersBatch();
    }

    @Test
    void scheduledOpenOrderTickRemainsIndependent() {
        MarketplaceOrderServiceImpl orderService = mock(MarketplaceOrderServiceImpl.class);
        MarketplacePaymentReconciliationWorker worker =
                new MarketplacePaymentReconciliationWorker(orderService);

        worker.reconcileOrdinaryOpenOrders();

        verify(orderService).reconcileOpenOrdersBatch();
    }
}
