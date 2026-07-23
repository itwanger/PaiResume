package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.MarketplaceFeatureProperties;
import com.itwanger.pairesume.entity.ResumeViewOrder;
import com.itwanger.pairesume.mapper.ResumeMarketListingMapper;
import com.itwanger.pairesume.mapper.ResumeViewOrderMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.payment.MarketplaceOrderStatus;
import com.itwanger.pairesume.payment.MarketplacePaymentGateway;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.payment.PaymentNotificationRequest;
import com.itwanger.pairesume.payment.QrCodeDataUrlGenerator;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MarketplaceOrderServiceImplTest {
    @Mock private MarketplaceOrderLocalService localOrderService;
    @Mock private MarketplaceOrderSettlementService settlementService;
    @Mock private MarketplacePaymentGateway paymentGateway;
    @Mock private MarketplacePaymentProperties paymentProperties;
    @Mock private MarketplaceFeatureProperties marketplaceFeatureProperties;
    @Mock private ResumeMarketListingMapper listingMapper;
    @Mock private ResumeViewOrderMapper orderMapper;
    @Mock private UserMapper userMapper;
    @Mock private QrCodeDataUrlGenerator qrCodeGenerator;
    @Mock private MarketplaceRefundReversalService refundReversalService;
    @InjectMocks private MarketplaceOrderServiceImpl service;

    @Test
    void refreshRateClaimPreventsRepeatedProviderQueries() {
        ResumeViewOrder order = new ResumeViewOrder();
        order.setId(10L);
        order.setOrderNo("PR-1");
        order.setListingId(1L);
        order.setOrderStatus(MarketplaceOrderStatus.PENDING.name());
        order.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        when(localOrderService.getAuthorizedOrder("PR-1", 7L, false)).thenReturn(order);
        when(localOrderService.claimProviderQuery(10L)).thenReturn(false);

        var dto = service.refreshOrder("PR-1", 7L, false);

        assertEquals(MarketplaceOrderStatus.PENDING.name(), dto.getOrderStatus());
        verify(paymentGateway, never()).queryOrder("PR-1");
    }

    @Test
    void stalePrepayLeaseRecoversByQueryingProviderWithoutClearingUnknownStateEarly() {
        ResumeViewOrder prepaying = new ResumeViewOrder();
        prepaying.setId(10L);
        prepaying.setOrderNo("PR-1");
        prepaying.setListingId(1L);
        prepaying.setBuyerUserId(7L);
        prepaying.setProvider("wechat");
        prepaying.setOrderStatus(MarketplaceOrderStatus.PREPAYING.name());
        prepaying.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        ResumeViewOrder unknown = new ResumeViewOrder();
        unknown.setId(10L);
        unknown.setOrderNo("PR-1");
        unknown.setListingId(1L);
        unknown.setBuyerUserId(7L);
        unknown.setProvider("wechat");
        unknown.setOrderStatus(MarketplaceOrderStatus.PREPAY_UNKNOWN.name());
        unknown.setExpiresAt(prepaying.getExpiresAt());
        ResumeViewOrder failed = new ResumeViewOrder();
        failed.setId(10L);
        failed.setOrderNo("PR-1");
        failed.setListingId(1L);
        failed.setBuyerUserId(7L);
        failed.setProvider("wechat");
        failed.setOrderStatus(MarketplaceOrderStatus.FAILED.name());
        failed.setExpiresAt(prepaying.getExpiresAt());
        when(localOrderService.getAuthorizedOrder("PR-1", 7L, false)).thenReturn(prepaying);
        when(localOrderService.recoverStalePrepay(10L)).thenReturn(true);
        when(localOrderService.getById(10L)).thenReturn(unknown);
        when(localOrderService.claimProviderQuery(10L)).thenReturn(true);
        when(paymentGateway.provider()).thenReturn("wechat");
        ProviderPaymentResult missing = new ProviderPaymentResult(
                PaymentProviderState.FAILED, "PR-1", null,
                "app", "mch", "CNY", null, null);
        when(paymentGateway.queryOrder("PR-1")).thenReturn(missing);
        when(localOrderService.applyNonPaidProviderResult("PR-1", missing)).thenReturn(failed);

        var dto = service.refreshOrder("PR-1", 7L, false);

        assertEquals(MarketplaceOrderStatus.FAILED.name(), dto.getOrderStatus());
        verify(paymentGateway).queryOrder("PR-1");
    }

    @Test
    void saleClosedPendingOrderIsClosedAndNeverReturnsOldQrCode() {
        ResumeViewOrder order = reviewableOrder(MarketplaceOrderStatus.PENDING);
        order.setIdempotencyKey("old-key-123");
        order.setActiveOrderKey("1:7");
        order.setSaleClosedAt(LocalDateTime.now().minusSeconds(1));
        order.setSaleCloseReason("REVISION_REPLACED");
        order.setCodeUrl("weixin://wxpay/stale");
        ResumeViewOrder closed = reviewableOrder(MarketplaceOrderStatus.CLOSED);
        closed.setIdempotencyKey("old-key-123");
        closed.setSaleClosedAt(order.getSaleClosedAt());
        closed.setSaleCloseReason(order.getSaleCloseReason());
        ProviderPaymentResult pending = new ProviderPaymentResult(
                PaymentProviderState.PENDING, "PR-1", null,
                "app", "mch", "CNY", 1000, null);
        ProviderPaymentResult providerClosed = new ProviderPaymentResult(
                PaymentProviderState.CLOSED, "PR-1", null,
                "app", "mch", "CNY", 1000, null);
        when(paymentGateway.provider()).thenReturn("wechat");
        when(marketplaceFeatureProperties.isEnabled()).thenReturn(true);
        when(paymentProperties.isMarketplaceAcceptNewOrders()).thenReturn(true);
        when(localOrderService.findOrCreate(
                "slug", 7L, false, "old-key-123", "wechat", "WECHAT_NATIVE", true))
                .thenReturn(new MarketplaceOrderDecision(order, null));
        when(localOrderService.claimProviderQuery(10L)).thenReturn(true);
        when(paymentGateway.queryOrder("PR-1")).thenReturn(pending, providerClosed);
        when(localOrderService.applyNonPaidProviderResult("PR-1", pending)).thenReturn(order);
        when(localOrderService.applyNonPaidProviderResult("PR-1", providerClosed)).thenReturn(closed);

        var dto = service.createOrder("slug", 7L, false, "old-key-123", "127.0.0.1");

        assertEquals(MarketplaceOrderStatus.CLOSED.name(), dto.getOrderStatus());
        assertNull(dto.getCodeUrl());
        assertNull(dto.getQrCodeDataUrl());
        verify(paymentGateway).closeOrder("PR-1");
        verify(qrCodeGenerator, never()).generate("weixin://wxpay/stale");
    }

    @Test
    void pausedProviderRejectsNewOrderButRemainsAvailableForOtherPaymentWork() {
        when(marketplaceFeatureProperties.isEnabled()).thenReturn(true);
        when(paymentProperties.isMarketplaceAcceptNewOrders()).thenReturn(false);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.createOrder("slug", 7L, false, "new-key-123", "127.0.0.1"));

        assertEquals(ResultCode.PAYMENT_NOT_ENABLED.getCode(), exception.getCode());
        verifyNoInteractions(localOrderService, paymentGateway);
    }

    @Test
    void closedMarketplaceRejectsNewOrderBeforeReadingPaymentSwitch() {
        when(marketplaceFeatureProperties.isEnabled()).thenReturn(false);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.createOrder("slug", 7L, false, "new-key-123", "127.0.0.1"));

        assertEquals(ResultCode.PAYMENT_NOT_ENABLED.getCode(), exception.getCode());
        verifyNoInteractions(paymentProperties, localOrderService, paymentGateway);
    }

    @Test
    void pausedNewOrdersStillAcceptVerifiedWechatCallback() {
        PaymentNotificationRequest notification = new PaymentNotificationRequest(
                "serial", "nonce", "timestamp", "signature", "body");
        ProviderPaymentResult providerPaid = providerResult(
                PaymentProviderState.PAID, LocalDateTime.now().minusSeconds(1));
        when(paymentGateway.provider()).thenReturn("wechat");
        when(paymentGateway.verifyNotification(notification)).thenReturn(providerPaid);

        service.handleWechatNotification(notification);

        verify(settlementService).settlePaidNotification("PR-1", providerPaid);
        verify(paymentProperties, never()).isMarketplaceAcceptNewOrders();
    }

    @Test
    void scheduledReconciliationQueriesLivePendingOrderWithoutClosingIt() {
        ResumeViewOrder pending = leasedOpenOrder(
                MarketplaceOrderStatus.PENDING, LocalDateTime.now().plusMinutes(5));
        ProviderPaymentResult providerPending = providerResult(PaymentProviderState.PENDING, null);
        when(paymentGateway.provider()).thenReturn("wechat");
        when(localOrderService.listOpenReconciliationCandidateIds("wechat")).thenReturn(java.util.List.of(10L));
        // The production token is random, so accept it and copy it onto the
        // database snapshot returned after the claim.
        org.mockito.stubbing.Answer<Boolean> claim = invocation -> {
            pending.setReconcileLeaseToken(invocation.getArgument(2));
            return true;
        };
        when(localOrderService.claimOpenOrderReconciliation(
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.eq("wechat"),
                org.mockito.ArgumentMatchers.anyString())).thenAnswer(claim);
        when(localOrderService.getById(10L)).thenReturn(pending);
        when(paymentGateway.queryOrder("PR-1")).thenReturn(providerPending);
        when(localOrderService.applyNonPaidProviderResult("PR-1", providerPending)).thenReturn(pending);

        service.reconcileOpenOrdersBatch();

        verify(paymentGateway).queryOrder("PR-1");
        verify(paymentGateway, never()).closeOrder("PR-1");
        verify(localOrderService, never()).expirePendingUnderReconciliationLease(
                org.mockito.ArgumentMatchers.eq(10L), org.mockito.ArgumentMatchers.anyString());
        verify(localOrderService).releaseReconciliationLease(
                org.mockito.ArgumentMatchers.eq(10L), org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void scheduledReconciliationCatchesPaidOrderWhenCallbackWasLost() {
        ResumeViewOrder pending = leasedOpenOrder(
                MarketplaceOrderStatus.PENDING, LocalDateTime.now().plusMinutes(5));
        ResumeViewOrder paid = leasedOpenOrder(
                MarketplaceOrderStatus.PAID, pending.getExpiresAt());
        ProviderPaymentResult providerPaid = providerResult(
                PaymentProviderState.PAID, LocalDateTime.now().minusSeconds(2));
        stubLeasedCandidate(pending);
        when(paymentGateway.queryOrder("PR-1")).thenReturn(providerPaid);
        when(settlementService.settlePaidOrder("PR-1", providerPaid)).thenReturn(paid);

        service.reconcileOpenOrdersBatch();

        verify(settlementService).settlePaidOrder("PR-1", providerPaid);
        verify(paymentGateway, never()).closeOrder("PR-1");
    }

    @Test
    void paidHoldReconciliationRunsWhileNewCheckoutIsPaused() {
        ResumeViewOrder paid = new ResumeViewOrder();
        paid.setId(10L);
        paid.setOrderNo("PR-1");
        paid.setProvider("wechat");
        paid.setOrderStatus(MarketplaceOrderStatus.PAID.name());
        ProviderPaymentResult providerPaid = providerResult(
                PaymentProviderState.PAID, LocalDateTime.now().minusDays(1));
        when(paymentGateway.provider()).thenReturn("wechat");
        when(paymentProperties.getPaidOrderReconciliationIntervalMinutes()).thenReturn(360);
        when(paymentProperties.getPaidOrderDueReconciliationRetryMinutes()).thenReturn(5);
        when(localOrderService.listHoldingPaidReconciliationCandidateIds(
                org.mockito.ArgumentMatchers.eq("wechat"),
                org.mockito.ArgumentMatchers.any(LocalDateTime.class),
                org.mockito.ArgumentMatchers.any(LocalDateTime.class)))
                .thenReturn(java.util.List.of(10L));
        when(localOrderService.claimHoldingPaidReconciliation(
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.eq("wechat"),
                org.mockito.ArgumentMatchers.any(LocalDateTime.class),
                org.mockito.ArgumentMatchers.any(LocalDateTime.class),
                org.mockito.ArgumentMatchers.anyString())).thenAnswer(invocation -> {
                    paid.setReconcileLeaseToken(invocation.getArgument(4));
                    return true;
                });
        when(localOrderService.getById(10L)).thenReturn(paid);
        when(paymentGateway.queryOrder("PR-1")).thenReturn(providerPaid);
        when(settlementService.settlePaidOrder("PR-1", providerPaid)).thenReturn(paid);

        service.reconcileHoldingPaidOrdersBatch();

        verify(paymentGateway).queryOrder("PR-1");
        verify(settlementService).settlePaidOrder("PR-1", providerPaid);
        verify(paymentProperties, never()).isMarketplaceAcceptNewOrders();
        verify(localOrderService).releaseReconciliationLease(
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void scheduledReconciliationQueriesThenClosesOnlyExpiredPendingOrder() {
        ResumeViewOrder pending = leasedOpenOrder(
                MarketplaceOrderStatus.PENDING, LocalDateTime.now().minusSeconds(1));
        ResumeViewOrder closed = leasedOpenOrder(
                MarketplaceOrderStatus.CLOSED, pending.getExpiresAt());
        ProviderPaymentResult providerPending = providerResult(PaymentProviderState.PENDING, null);
        ProviderPaymentResult providerClosed = providerResult(PaymentProviderState.CLOSED, null);
        stubLeasedCandidate(pending);
        when(paymentGateway.queryOrder("PR-1")).thenReturn(providerPending, providerClosed);
        when(localOrderService.applyNonPaidProviderResult("PR-1", providerPending)).thenReturn(pending);
        when(localOrderService.applyNonPaidProviderResult("PR-1", providerClosed)).thenReturn(closed);
        when(localOrderService.expirePendingUnderReconciliationLease(
                org.mockito.ArgumentMatchers.eq(10L), org.mockito.ArgumentMatchers.anyString())).thenReturn(true);
        when(localOrderService.renewReconciliationLease(
                org.mockito.ArgumentMatchers.eq(10L), org.mockito.ArgumentMatchers.anyString())).thenReturn(true);

        service.reconcileOpenOrdersBatch();

        verify(paymentGateway).closeOrder("PR-1");
        verify(localOrderService).expirePendingUnderReconciliationLease(
                org.mockito.ArgumentMatchers.eq(10L), org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void manualRefundDelegatesToSingleAccountingBoundary() {
        ResumeViewOrder order = reviewableOrder(MarketplaceOrderStatus.REFUND_REQUIRED);
        order.setOrderStatus(MarketplaceOrderStatus.REFUNDED.name());
        order.setRefundReference("WX-REFUND-1");
        when(refundReversalService.confirmManualFullRefund(
                "PR-1", 99L, "WX-REFUND-1", "merchant verified")).thenReturn(order);

        var result = service.confirmManualRefund(
                "PR-1", 99L, "WX-REFUND-1", "merchant verified");

        assertEquals(MarketplaceOrderStatus.REFUNDED.name(), result.getOrderStatus());
        verify(refundReversalService).confirmManualFullRefund(
                "PR-1", 99L, "WX-REFUND-1", "merchant verified");
    }

    private ResumeViewOrder reviewableOrder(MarketplaceOrderStatus status) {
        ResumeViewOrder order = new ResumeViewOrder();
        order.setId(10L);
        order.setOrderNo("PR-1");
        order.setListingId(1L);
        order.setListingRevisionId(20L);
        order.setBuyerUserId(7L);
        order.setSellerUserId(8L);
        order.setProvider("wechat");
        order.setAmountCents(1000);
        order.setOrderStatus(status.name());
        order.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        return order;
    }

    private ResumeViewOrder leasedOpenOrder(MarketplaceOrderStatus status, LocalDateTime expiresAt) {
        ResumeViewOrder order = reviewableOrder(status);
        order.setActiveOrderKey("1:7");
        order.setExpiresAt(expiresAt);
        return order;
    }

    private void stubLeasedCandidate(ResumeViewOrder order) {
        when(paymentGateway.provider()).thenReturn("wechat");
        when(localOrderService.listOpenReconciliationCandidateIds("wechat")).thenReturn(java.util.List.of(10L));
        when(localOrderService.claimOpenOrderReconciliation(
                org.mockito.ArgumentMatchers.eq(10L),
                org.mockito.ArgumentMatchers.eq("wechat"),
                org.mockito.ArgumentMatchers.anyString())).thenAnswer(invocation -> {
                    order.setReconcileLeaseToken(invocation.getArgument(2));
                    return true;
                });
        when(localOrderService.getById(10L)).thenReturn(order);
    }

    private ProviderPaymentResult providerResult(PaymentProviderState state, LocalDateTime paidAt) {
        return new ProviderPaymentResult(
                state,
                "PR-1",
                state == PaymentProviderState.PAID ? "TX-1" : null,
                "app",
                "mch",
                "CNY",
                1000,
                paidAt
        );
    }
}
