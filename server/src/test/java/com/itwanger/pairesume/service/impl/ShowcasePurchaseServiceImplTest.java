package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.entity.ResumeShowcase;
import com.itwanger.pairesume.entity.ShowcasePurchaseOrder;
import com.itwanger.pairesume.mapper.ResumeShowcaseMapper;
import com.itwanger.pairesume.mapper.ShowcasePurchaseOrderMapper;
import com.itwanger.pairesume.payment.MarketplacePaymentGateway;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.payment.PaymentPrepayResult;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import com.itwanger.pairesume.payment.QrCodeDataUrlGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShowcasePurchaseServiceImplTest {
    private static final String TOKEN = "0123456789abcdef0123456789abcdef0123456789a";

    @Mock private ResumeShowcaseMapper showcaseMapper;
    @Mock private ShowcasePurchaseOrderMapper orderMapper;
    @Mock private MarketplacePaymentGateway paymentGateway;
    @Mock private QrCodeDataUrlGenerator qrCodeGenerator;

    private MarketplacePaymentProperties properties;
    private ShowcasePurchaseServiceImpl service;

    @BeforeEach
    void setUp() {
        properties = new MarketplacePaymentProperties();
        properties.setProvider("mock");
        properties.setOrderExpireMinutes(15);
        service = new ShowcasePurchaseServiceImpl(
                showcaseMapper, orderMapper, paymentGateway, properties, qrCodeGenerator);
    }

    @Test
    void paymentAvailabilityFollowsTheConfiguredProvider() {
        when(paymentGateway.provider()).thenReturn("mock", "disabled");

        assertTrue(service.isPaymentEnabled());
        assertFalse(service.isPaymentEnabled());
    }

    @Test
    void anonymousOrderUsesAdminShowcasePriceAndStoresOnlyTokenHash() {
        ResumeShowcase showcase = paidShowcase();
        when(showcaseMapper.selectOne(any())).thenReturn(showcase);
        when(paymentGateway.provider()).thenReturn("mock");
        when(paymentGateway.createNativeOrder(any())).thenAnswer(invocation -> {
            var request = invocation.getArgument(0, com.itwanger.pairesume.payment.PaymentPrepayRequest.class);
            return new PaymentPrepayResult("mock", "prepay", "mock://pay", request.expiresAt());
        });
        when(qrCodeGenerator.generate("mock://pay")).thenReturn("data:image/png;base64,AA");
        when(showcaseMapper.selectById(11L)).thenReturn(showcase);

        var result = service.createOrder("featured-65", TOKEN, "request-1", "127.0.0.1");

        ArgumentCaptor<ShowcasePurchaseOrder> orderCaptor = ArgumentCaptor.forClass(ShowcasePurchaseOrder.class);
        org.mockito.Mockito.verify(orderMapper).insert(orderCaptor.capture());
        ShowcasePurchaseOrder stored = orderCaptor.getValue();
        assertEquals(6600, stored.getAmountCents());
        assertEquals(64, stored.getPurchaseTokenHash().length());
        assertNotEquals(TOKEN, stored.getPurchaseTokenHash());
        assertTrue(stored.getOrderNo().startsWith("PO"));
        assertEquals(32, stored.getOrderNo().length());
        assertEquals("PENDING", result.getOrderStatus());
        assertEquals(6600, result.getAmountCents());
        assertFalse(result.getUnlocked());
    }

    @Test
    void paidProviderResultUnlocksOnlyTheMatchingBrowserCredential() {
        ShowcasePurchaseOrder order = pendingOrder();
        when(orderMapper.selectByOrderNo(any())).thenReturn(order);
        when(orderMapper.selectByOrderNoForUpdate(any())).thenReturn(order);
        when(paymentGateway.provider()).thenReturn("mock");
        when(paymentGateway.expectedAppId()).thenReturn("mock-app");
        when(paymentGateway.expectedMerchantId()).thenReturn("mock-merchant");
        when(paymentGateway.queryOrder(order.getOrderNo())).thenReturn(new ProviderPaymentResult(
                PaymentProviderState.PAID,
                order.getOrderNo(),
                "transaction-1",
                "mock-app",
                "mock-merchant",
                "CNY",
                6600,
                LocalDateTime.now()
        ));
        when(showcaseMapper.selectById(11L)).thenReturn(paidShowcase());

        var result = service.refreshOrder(order.getOrderNo(), TOKEN);

        assertEquals("PAID", result.getOrderStatus());
        assertTrue(result.getUnlocked());
        assertEquals("transaction-1", order.getProviderTransactionId());
        assertEquals(null, order.getActiveOrderKey());
    }

    @Test
    void expiredPendingOrderClosesProviderAndReleasesActiveOrderKey() {
        ShowcasePurchaseOrder order = expiredPendingOrder();
        stubRefreshOrder(order);
        when(showcaseMapper.selectById(11L)).thenReturn(paidShowcase());
        when(paymentGateway.queryOrder(order.getOrderNo())).thenReturn(
                providerResult(order, PaymentProviderState.PENDING, null, null),
                providerResult(order, PaymentProviderState.CLOSED, null, null)
        );
        List<String> persistedStates = new ArrayList<>();
        doAnswer(invocation -> {
            ShowcasePurchaseOrder update = invocation.getArgument(0);
            persistedStates.add(update.getOrderStatus() + ":" + update.getActiveOrderKey());
            return 1;
        }).when(orderMapper).updateById(any(ShowcasePurchaseOrder.class));

        var result = service.refreshOrder(order.getOrderNo(), TOKEN);

        assertEquals("CLOSED", result.getOrderStatus());
        assertEquals(null, order.getActiveOrderKey());
        assertFalse(persistedStates.contains("EXPIRED:11:hash"));
        assertTrue(persistedStates.contains("CLOSED:null"));
        verify(paymentGateway).closeOrder(order.getOrderNo());
        verify(paymentGateway, times(2)).queryOrder(order.getOrderNo());
    }

    @Test
    void successfulCloseReleasesExpiredOrderEvenWhenProviderRecheckStillLooksPending() {
        ShowcasePurchaseOrder order = expiredPendingOrder();
        stubRefreshOrder(order);
        when(showcaseMapper.selectById(11L)).thenReturn(paidShowcase());
        when(paymentGateway.queryOrder(order.getOrderNo())).thenReturn(
                providerResult(order, PaymentProviderState.PENDING, null, null),
                providerResult(order, PaymentProviderState.PENDING, null, null)
        );

        var result = service.refreshOrder(order.getOrderNo(), TOKEN);

        assertEquals("EXPIRED", result.getOrderStatus());
        assertEquals(null, order.getActiveOrderKey());
        assertTrue(order.getClosedAt() != null);
        verify(paymentGateway).closeOrder(order.getOrderNo());
    }

    @Test
    void paidResultAfterProviderCloseStillUnlocksExpiredOrder() {
        ShowcasePurchaseOrder order = expiredPendingOrder();
        LocalDateTime paidAt = LocalDateTime.now();
        stubRefreshOrder(order);
        when(showcaseMapper.selectById(11L)).thenReturn(paidShowcase());
        when(paymentGateway.queryOrder(order.getOrderNo())).thenReturn(
                providerResult(order, PaymentProviderState.PENDING, null, null),
                providerResult(order, PaymentProviderState.PAID, "transaction-late", paidAt)
        );

        var result = service.refreshOrder(order.getOrderNo(), TOKEN);

        assertEquals("PAID", result.getOrderStatus());
        assertTrue(result.getUnlocked());
        assertEquals("transaction-late", order.getProviderTransactionId());
        assertEquals(paidAt, order.getPaidAt());
        assertEquals(null, order.getActiveOrderKey());
        verify(paymentGateway).closeOrder(order.getOrderNo());
    }

    @Test
    void paidResultBeforeProviderCloseSkipsCloseAndUnlocksExpiredOrder() {
        ShowcasePurchaseOrder order = expiredPendingOrder();
        stubRefreshOrder(order);
        when(showcaseMapper.selectById(11L)).thenReturn(paidShowcase());
        when(paymentGateway.queryOrder(order.getOrderNo())).thenReturn(
                providerResult(order, PaymentProviderState.PAID, "transaction-before-close", LocalDateTime.now())
        );

        var result = service.refreshOrder(order.getOrderNo(), TOKEN);

        assertEquals("PAID", result.getOrderStatus());
        assertTrue(result.getUnlocked());
        verify(paymentGateway, never()).closeOrder(any());
        verify(paymentGateway).queryOrder(order.getOrderNo());
    }

    @Test
    void lockedRereadPreservesConcurrentPaidResultInsteadOfApplyingStalePendingQuery() {
        ShowcasePurchaseOrder initial = expiredPendingOrder();
        ShowcasePurchaseOrder concurrentlyPaid = expiredPendingOrder();
        concurrentlyPaid.setOrderStatus("PAID");
        concurrentlyPaid.setProviderTransactionId("transaction-callback");
        concurrentlyPaid.setPaidAt(LocalDateTime.now());
        concurrentlyPaid.setActiveOrderKey(null);
        when(orderMapper.selectByOrderNo(initial.getOrderNo())).thenReturn(initial);
        when(orderMapper.selectByOrderNoForUpdate(initial.getOrderNo())).thenReturn(concurrentlyPaid);
        when(paymentGateway.queryOrder(initial.getOrderNo())).thenReturn(
                providerResult(initial, PaymentProviderState.PENDING, null, null)
        );
        when(showcaseMapper.selectById(11L)).thenReturn(paidShowcase());

        var result = service.refreshOrder(initial.getOrderNo(), TOKEN);

        assertEquals("PAID", result.getOrderStatus());
        assertTrue(result.getUnlocked());
        assertEquals("transaction-callback", concurrentlyPaid.getProviderTransactionId());
        verify(paymentGateway, never()).closeOrder(any());
        verify(orderMapper, never()).updateById(any(ShowcasePurchaseOrder.class));
    }

    @Test
    void lockedRereadPreservesConcurrentClosedResultInsteadOfApplyingStalePendingQuery() {
        assertLockedTerminalIsPreserved("CLOSED");
    }

    @Test
    void lockedRereadPreservesConcurrentFailedResultInsteadOfApplyingStalePendingQuery() {
        assertLockedTerminalIsPreserved("FAILED");
    }

    @Test
    void lockedRereadPreservesFinishedExpiredResultInsteadOfApplyingStalePendingQuery() {
        assertLockedTerminalIsPreserved("EXPIRED");
    }

    @Test
    void prepayUnknownClosesAndRechecksWithoutWaitingForLocalExpiry() {
        ShowcasePurchaseOrder order = pendingOrder();
        order.setOrderStatus("PREPAY_UNKNOWN");
        order.setCodeUrl(null);
        order.setExpiresAt(LocalDateTime.now().plusMinutes(10));
        stubRefreshOrder(order);
        when(showcaseMapper.selectById(11L)).thenReturn(paidShowcase());
        when(paymentGateway.queryOrder(order.getOrderNo())).thenReturn(
                providerResult(order, PaymentProviderState.PENDING, null, null),
                providerResult(order, PaymentProviderState.CLOSED, null, null)
        );

        var result = service.refreshOrder(order.getOrderNo(), TOKEN);

        assertEquals("CLOSED", result.getOrderStatus());
        assertEquals(null, order.getActiveOrderKey());
        verify(paymentGateway).closeOrder(order.getOrderNo());
        verify(paymentGateway, times(2)).queryOrder(order.getOrderNo());
    }

    @Test
    void closeFailureKeepsExpiredOrderReservedWhileProviderStillReportsPending() {
        ShowcasePurchaseOrder order = expiredPendingOrder();
        stubRefreshOrder(order);
        when(paymentGateway.queryOrder(order.getOrderNo())).thenReturn(
                providerResult(order, PaymentProviderState.PENDING, null, null),
                providerResult(order, PaymentProviderState.PENDING, null, null)
        );
        doThrow(new IllegalStateException("close failed"))
                .when(paymentGateway).closeOrder(order.getOrderNo());

        assertThrows(com.itwanger.pairesume.common.BusinessException.class,
                () -> service.refreshOrder(order.getOrderNo(), TOKEN));

        assertEquals("PENDING", order.getOrderStatus());
        assertEquals("11:hash", order.getActiveOrderKey());
        verify(paymentGateway).closeOrder(order.getOrderNo());
        verify(paymentGateway, times(2)).queryOrder(order.getOrderNo());
    }

    @Test
    void latestOrderRestoresThePaidOrderForTheMatchingBrowserCredential() {
        ResumeShowcase showcase = paidShowcase();
        ShowcasePurchaseOrder paid = pendingOrder();
        paid.setOrderStatus("PAID");
        paid.setPaidAt(LocalDateTime.now().minusMinutes(2));
        paid.setActiveOrderKey(null);
        when(showcaseMapper.selectOne(any())).thenReturn(showcase);
        when(orderMapper.selectOne(any())).thenReturn(paid);
        when(showcaseMapper.selectById(11L)).thenReturn(showcase);

        var result = service.getLatestOrder("featured-65", TOKEN);

        assertEquals(paid.getOrderNo(), result.getOrderNo());
        assertEquals("PAID", result.getOrderStatus());
        assertTrue(result.getUnlocked());
    }

    @Test
    void latestOrderRestoresTheActivePaymentQrCode() {
        ResumeShowcase showcase = paidShowcase();
        ShowcasePurchaseOrder pending = pendingOrder();
        pending.setCodeUrl("mock://pay");
        when(showcaseMapper.selectOne(any())).thenReturn(showcase);
        when(orderMapper.selectByActiveOrderKey(any())).thenReturn(pending);
        when(showcaseMapper.selectById(11L)).thenReturn(showcase);
        when(qrCodeGenerator.generate("mock://pay")).thenReturn("data:image/png;base64,AA");

        var result = service.getLatestOrder("featured-65", TOKEN);

        assertEquals(pending.getOrderNo(), result.getOrderNo());
        assertEquals("PENDING", result.getOrderStatus());
        assertEquals("data:image/png;base64,AA", result.getQrCodeDataUrl());
        assertFalse(result.getUnlocked());
    }

    private ResumeShowcase paidShowcase() {
        ResumeShowcase showcase = new ResumeShowcase();
        showcase.setId(11L);
        showcase.setSlug("featured-65");
        showcase.setPublishStatus("PUBLISHED");
        showcase.setAccessType("PAID");
        showcase.setPriceCents(6600);
        return showcase;
    }

    private ShowcasePurchaseOrder pendingOrder() {
        ShowcasePurchaseOrder order = new ShowcasePurchaseOrder();
        order.setId(20L);
        order.setOrderNo("PO123");
        order.setShowcaseId(11L);
        order.setPurchaseTokenHash("263b9741bfc84598b8f5688c5481887c8493d40b0b557de2f2f9b0329139c5db");
        order.setActiveOrderKey("11:hash");
        order.setAmountCents(6600);
        order.setCurrency("CNY");
        order.setProvider("mock");
        order.setPayChannel("MOCK_NATIVE");
        order.setOrderStatus("PENDING");
        order.setExpiresAt(LocalDateTime.now().plusMinutes(10));
        return order;
    }

    private ShowcasePurchaseOrder expiredPendingOrder() {
        ShowcasePurchaseOrder order = pendingOrder();
        order.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        return order;
    }

    private void stubRefreshOrder(ShowcasePurchaseOrder order) {
        when(orderMapper.selectByOrderNo(order.getOrderNo())).thenReturn(order);
        when(orderMapper.selectByOrderNoForUpdate(order.getOrderNo())).thenReturn(order);
        when(paymentGateway.provider()).thenReturn("mock");
        when(paymentGateway.expectedAppId()).thenReturn("mock-app");
        when(paymentGateway.expectedMerchantId()).thenReturn("mock-merchant");
    }

    private void assertLockedTerminalIsPreserved(String terminalStatus) {
        ShowcasePurchaseOrder initial = expiredPendingOrder();
        ShowcasePurchaseOrder terminal = expiredPendingOrder();
        terminal.setOrderStatus(terminalStatus);
        terminal.setActiveOrderKey(null);
        terminal.setClosedAt(LocalDateTime.now());
        when(orderMapper.selectByOrderNo(initial.getOrderNo())).thenReturn(initial);
        when(orderMapper.selectByOrderNoForUpdate(initial.getOrderNo())).thenReturn(terminal);
        when(paymentGateway.queryOrder(initial.getOrderNo())).thenReturn(
                providerResult(initial, PaymentProviderState.PENDING, null, null)
        );
        when(showcaseMapper.selectById(11L)).thenReturn(paidShowcase());

        var result = service.refreshOrder(initial.getOrderNo(), TOKEN);

        assertEquals(terminalStatus, result.getOrderStatus());
        assertEquals(null, terminal.getActiveOrderKey());
        verify(paymentGateway, never()).closeOrder(any());
        verify(orderMapper, never()).updateById(any(ShowcasePurchaseOrder.class));
    }

    private ProviderPaymentResult providerResult(
            ShowcasePurchaseOrder order,
            PaymentProviderState state,
            String transactionId,
            LocalDateTime paidAt
    ) {
        return new ProviderPaymentResult(
                state,
                order.getOrderNo(),
                transactionId,
                "mock-app",
                "mock-merchant",
                state == PaymentProviderState.CLOSED || state == PaymentProviderState.FAILED
                        ? null
                        : "CNY",
                state == PaymentProviderState.CLOSED || state == PaymentProviderState.FAILED
                        ? null
                        : order.getAmountCents(),
                paidAt
        );
    }
}
