package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.entity.MembershipPaymentOrder;
import com.itwanger.pairesume.payment.MarketplacePaymentGateway;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.payment.MembershipOrderStatus;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import com.itwanger.pairesume.payment.QrCodeDataUrlGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MembershipOrderServiceImplTest {
    @Mock private MembershipOrderLocalService localService;
    @Mock private MembershipOrderSettlementService settlementService;
    @Mock private MarketplacePaymentGateway paymentGateway;
    @Mock private MarketplacePaymentProperties paymentProperties;
    @Mock private QrCodeDataUrlGenerator qrCodeGenerator;

    private MembershipOrderServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new MembershipOrderServiceImpl(
                localService, settlementService, paymentGateway, paymentProperties, qrCodeGenerator);
    }

    @Test
    void refreshExpiredOrderQueriesThenClosesThenConfirmsCancellation() {
        MembershipPaymentOrder pending = order(MembershipOrderStatus.PENDING);
        MembershipPaymentOrder canceled = order(MembershipOrderStatus.CANCELED);
        canceled.setActiveOrderKey(null);
        ProviderPaymentResult providerPending = result(PaymentProviderState.PENDING, pending);
        ProviderPaymentResult providerClosed = result(PaymentProviderState.CLOSED, pending);
        when(localService.getAuthorized(pending.getOrderNo(), 7L)).thenReturn(pending);
        when(paymentGateway.provider()).thenReturn("wechat");
        when(localService.claimProviderQuery(5L)).thenReturn(true);
        when(paymentGateway.queryOrder(pending.getOrderNo())).thenReturn(providerPending, providerClosed);
        when(localService.applyNonPaidResult(pending.getOrderNo(), providerPending)).thenReturn(pending);
        when(localService.markExpiredIfDue(5L)).thenReturn(true);
        when(localService.applyNonPaidResult(pending.getOrderNo(), providerClosed)).thenReturn(canceled);

        var dto = service.refreshOrder(pending.getOrderNo(), 7L);

        assertEquals(MembershipOrderStatus.CANCELED.name(), dto.getOrderStatus());
        verify(paymentGateway).closeOrder(pending.getOrderNo());
        verify(paymentGateway, times(2)).queryOrder(pending.getOrderNo());
    }

    @Test
    void refreshSettlesPaidBeforeAnyDestructiveClose() {
        MembershipPaymentOrder pending = order(MembershipOrderStatus.PENDING);
        MembershipPaymentOrder paid = order(MembershipOrderStatus.PAID);
        paid.setActiveOrderKey(null);
        ProviderPaymentResult providerPaid = result(PaymentProviderState.PAID, pending);
        when(localService.getAuthorized(pending.getOrderNo(), 7L)).thenReturn(pending);
        when(paymentGateway.provider()).thenReturn("wechat");
        when(localService.claimProviderQuery(5L)).thenReturn(true);
        when(paymentGateway.queryOrder(pending.getOrderNo())).thenReturn(providerPaid);
        when(settlementService.settlePaid(pending.getOrderNo(), providerPaid)).thenReturn(paid);

        var dto = service.refreshOrder(pending.getOrderNo(), 7L);

        assertEquals(MembershipOrderStatus.PAID.name(), dto.getOrderStatus());
        verify(paymentGateway, never()).closeOrder(anyString());
    }

    @Test
    void refreshUnexpiredPendingOrderQueriesWithoutClosing() {
        MembershipPaymentOrder pending = order(MembershipOrderStatus.PENDING);
        pending.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        ProviderPaymentResult providerPending = result(PaymentProviderState.PENDING, pending);
        when(localService.getAuthorized(pending.getOrderNo(), 7L)).thenReturn(pending);
        when(paymentGateway.provider()).thenReturn("wechat");
        when(localService.claimProviderQuery(5L)).thenReturn(true);
        when(paymentGateway.queryOrder(pending.getOrderNo())).thenReturn(providerPending);
        when(localService.applyNonPaidResult(pending.getOrderNo(), providerPending)).thenReturn(pending);

        var dto = service.refreshOrder(pending.getOrderNo(), 7L);

        assertEquals(MembershipOrderStatus.PENDING.name(), dto.getOrderStatus());
        verify(paymentGateway, never()).closeOrder(anyString());
        verify(localService, never()).markExpiredIfDue(5L);
    }

    @Test
    void refreshDoesNotCloseWhenConcurrentCallbackSettledBeforeExpiryClaim() {
        MembershipPaymentOrder pending = order(MembershipOrderStatus.PENDING);
        MembershipPaymentOrder paid = order(MembershipOrderStatus.PAID);
        paid.setActiveOrderKey(null);
        ProviderPaymentResult providerPending = result(PaymentProviderState.PENDING, pending);
        when(localService.getAuthorized(pending.getOrderNo(), 7L)).thenReturn(pending);
        when(paymentGateway.provider()).thenReturn("wechat");
        when(localService.claimProviderQuery(5L)).thenReturn(true);
        when(paymentGateway.queryOrder(pending.getOrderNo())).thenReturn(providerPending);
        when(localService.applyNonPaidResult(pending.getOrderNo(), providerPending)).thenReturn(pending);
        when(localService.markExpiredIfDue(5L)).thenReturn(false);
        when(localService.getById(5L)).thenReturn(paid);

        var dto = service.refreshOrder(pending.getOrderNo(), 7L);

        assertEquals(MembershipOrderStatus.PAID.name(), dto.getOrderStatus());
        verify(paymentGateway, never()).closeOrder(anyString());
    }

    @Test
    void createNeverRevivesExpiredCreatedOrderAtProvider() {
        MembershipPaymentOrder expired = order(MembershipOrderStatus.CREATED);
        MembershipPaymentOrder canceled = order(MembershipOrderStatus.CANCELED);
        canceled.setActiveOrderKey(null);
        when(paymentProperties.isMembershipAcceptNewOrders()).thenReturn(true);
        when(paymentGateway.provider()).thenReturn("wechat");
        when(localService.findOrCreate(
                7L, "member-key-123", null, "wechat", "WECHAT_NATIVE"))
                .thenReturn(expired);
        when(localService.cancelExpiredCreated(5L)).thenReturn(true);
        when(localService.getById(5L)).thenReturn(canceled);

        var dto = service.createOrder(7L, "member-key-123", null, "127.0.0.1");

        assertEquals(MembershipOrderStatus.CANCELED.name(), dto.getOrderStatus());
        verify(paymentGateway, never()).createNativeOrder(org.mockito.ArgumentMatchers.any());
        verify(settlementService, never()).settleZeroAmount(5L);
    }

    @Test
    void pausedMembershipPaymentsRejectNewOrderBeforeAnyOrderOrProviderWork() {
        when(paymentProperties.isMembershipAcceptNewOrders()).thenReturn(false);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.createOrder(7L, "member-key-123", null, "127.0.0.1"));

        assertEquals(ResultCode.PAYMENT_NOT_ENABLED.getCode(), exception.getCode());
        verify(localService, never()).findOrCreate(
                7L, "member-key-123", null, "wechat", "WECHAT_NATIVE");
        verify(paymentGateway, never()).provider();
    }

    @Test
    void pausedMembershipPaymentsStillSettleVerifiedCallback() {
        MembershipPaymentOrder pending = order(MembershipOrderStatus.PENDING);
        ProviderPaymentResult providerPaid = result(PaymentProviderState.PAID, pending);

        service.handleVerifiedProviderNotification(providerPaid);

        verify(settlementService).settlePaid(pending.getOrderNo(), providerPaid);
        verify(paymentProperties, never()).isMembershipAcceptNewOrders();
    }

    @Test
    void workerUsesLeaseAndOnlyCancelsAfterPostCloseQuery() {
        MembershipPaymentOrder pending = order(MembershipOrderStatus.PENDING);
        ProviderPaymentResult providerPending = result(PaymentProviderState.PENDING, pending);
        ProviderPaymentResult providerClosed = result(PaymentProviderState.CLOSED, pending);
        MembershipPaymentOrder canceled = order(MembershipOrderStatus.CANCELED);
        when(paymentGateway.provider()).thenReturn("wechat");
        when(localService.listReconciliationCandidateIds("wechat")).thenReturn(List.of(5L));
        when(localService.claimReconciliation(eq(5L), eq("wechat"), anyString()))
                .thenAnswer(invocation -> {
                    pending.setReconcileLeaseToken(invocation.getArgument(2));
                    return true;
                });
        when(localService.getById(5L)).thenReturn(pending);
        when(paymentGateway.queryOrder(pending.getOrderNo())).thenReturn(providerPending, providerClosed);
        when(localService.applyNonPaidResult(pending.getOrderNo(), providerPending)).thenReturn(pending);
        when(localService.expirePendingUnderLease(eq(5L), anyString())).thenReturn(true);
        when(localService.renewLease(eq(5L), anyString())).thenReturn(true);
        when(localService.applyNonPaidResult(pending.getOrderNo(), providerClosed)).thenReturn(canceled);

        service.reconcileOpenOrdersBatch();

        verify(paymentGateway).closeOrder(pending.getOrderNo());
        verify(paymentGateway, times(2)).queryOrder(pending.getOrderNo());
        verify(localService).releaseLease(eq(5L), anyString());
    }

    @Test
    void workerCancelsExpiredCreatedOrderWithoutCallingProvider() {
        when(localService.listExpiredCreatedCandidateIds()).thenReturn(List.of(11L));
        when(localService.cancelExpiredCreated(11L)).thenReturn(true);
        when(paymentGateway.provider()).thenReturn("disabled");

        service.reconcileOpenOrdersBatch();

        verify(localService).cancelExpiredCreated(11L);
        verify(paymentGateway, never()).queryOrder(anyString());
        verify(paymentGateway, never()).closeOrder(anyString());
    }

    @Test
    void workerExposesPerOrderReconciliationFailuresToAdminSummary() {
        MembershipPaymentOrder pending = order(MembershipOrderStatus.PENDING);
        when(paymentGateway.provider()).thenReturn("wechat");
        when(localService.listReconciliationCandidateIds("wechat")).thenReturn(List.of(5L));
        when(localService.claimReconciliation(eq(5L), eq("wechat"), anyString()))
                .thenAnswer(invocation -> {
                    pending.setReconcileLeaseToken(invocation.getArgument(2));
                    return true;
                });
        when(localService.getById(5L)).thenReturn(pending);
        when(paymentGateway.queryOrder(pending.getOrderNo()))
                .thenThrow(new IllegalStateException("provider unavailable"));

        service.reconcileOpenOrdersBatch();

        assertEquals(1L, service.reconciliationMetrics().failureCount());
        verify(localService).releaseLease(eq(5L), anyString());
    }

    private MembershipPaymentOrder order(MembershipOrderStatus status) {
        MembershipPaymentOrder order = new MembershipPaymentOrder();
        order.setId(5L);
        order.setOrderNo("PM-test-order");
        order.setUserId(7L);
        order.setActiveOrderKey("MEMBERSHIP:7");
        order.setMembershipDays(30);
        order.setListPriceCents(6600);
        order.setDiscountAmountCents(0);
        order.setPayableAmountCents(6600);
        order.setCurrency("CNY");
        order.setProvider("wechat");
        order.setOrderStatus(status.name());
        order.setExpiresAt(LocalDateTime.now().minusSeconds(1));
        return order;
    }

    private ProviderPaymentResult result(PaymentProviderState state, MembershipPaymentOrder order) {
        return new ProviderPaymentResult(
                state, order.getOrderNo(), state == PaymentProviderState.PAID ? "tx" : null,
                "app", "merchant", "CNY", order.getPayableAmountCents(),
                state == PaymentProviderState.PAID ? LocalDateTime.now() : null);
    }
}
