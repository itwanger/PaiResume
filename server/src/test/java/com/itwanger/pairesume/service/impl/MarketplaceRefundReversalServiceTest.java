package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.entity.CreatorEarning;
import com.itwanger.pairesume.entity.CreatorWallet;
import com.itwanger.pairesume.entity.ResumeViewEntitlement;
import com.itwanger.pairesume.entity.ResumeViewOrder;
import com.itwanger.pairesume.mapper.CreatorEarningMapper;
import com.itwanger.pairesume.mapper.CreatorWalletMapper;
import com.itwanger.pairesume.mapper.ResumeViewEntitlementMapper;
import com.itwanger.pairesume.mapper.ResumeViewOrderMapper;
import com.itwanger.pairesume.payment.CreatorEarningStatus;
import com.itwanger.pairesume.payment.MarketplaceOrderStatus;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MarketplaceRefundReversalServiceTest {
    @Mock private ResumeViewOrderMapper orderMapper;
    @Mock private ResumeViewEntitlementMapper entitlementMapper;
    @Mock private CreatorEarningMapper earningMapper;
    @Mock private CreatorWalletMapper walletMapper;

    private MarketplaceRefundReversalService service;

    @BeforeEach
    void setUp() {
        service = new MarketplaceRefundReversalService(
                orderMapper, entitlementMapper, earningMapper, walletMapper);
    }

    @Test
    void providerRefundDuringHoldAtomicallyRevokesAccessAndHeldIncome() {
        ResumeViewOrder order = order(MarketplaceOrderStatus.PAID);
        ResumeViewEntitlement entitlement = entitlement();
        CreatorEarning earning = earning(CreatorEarningStatus.HOLDING, 100, 0);
        CreatorWallet wallet = wallet(100, 0, 0, 0);
        stubLedger(order, entitlement, earning, wallet);

        LocalDateTime reconciledAt = LocalDateTime.now();
        service.applyProviderFullRefund("PR-1", reconciledAt);

        assertEquals(MarketplaceOrderStatus.REFUNDED.name(), order.getOrderStatus());
        assertEquals("REVOKED", entitlement.getEntitlementStatus());
        assertEquals(CreatorEarningStatus.REVERSED.name(), earning.getEarningStatus());
        assertEquals(CreatorEarningStatus.HOLDING.name(), earning.getReversedFromStatus());
        assertEquals(0L, wallet.getHeldBalanceCents());
        assertEquals(0L, wallet.getDebtBalanceCents());
        assertEquals(100L, wallet.getLifetimeRefundedCents());
        assertNotNull(order.getRefundedAt());
        assertEquals(reconciledAt, order.getProviderReconciledAt());
    }

    @Test
    void refundRestoresDebtThatNewIncomeHadPreviouslyOffset() {
        ResumeViewOrder order = order(MarketplaceOrderStatus.PAID);
        CreatorEarning earning = earning(CreatorEarningStatus.HOLDING, 40, 60);
        CreatorWallet wallet = wallet(40, 0, 0, 0);
        stubLedger(order, entitlement(), earning, wallet);

        service.applyProviderFullRefund("PR-1", LocalDateTime.now());

        assertEquals(0L, wallet.getHeldBalanceCents());
        assertEquals(60L, wallet.getDebtBalanceCents());
        assertEquals(100L, wallet.getLifetimeRefundedCents());
    }

    @Test
    void refundAfterPayoutCreatesDebtWithoutRewritingPaidOutHistory() {
        ResumeViewOrder order = order(MarketplaceOrderStatus.PAID);
        CreatorEarning earning = earning(CreatorEarningStatus.SETTLED, 100, 0);
        CreatorWallet wallet = wallet(0, 0, 0, 0);
        wallet.setPaidOutCents(100L);
        stubLedger(order, entitlement(), earning, wallet);

        service.applyProviderFullRefund("PR-1", LocalDateTime.now());

        assertEquals(100L, wallet.getDebtBalanceCents());
        assertEquals(100L, wallet.getPaidOutCents());
        assertEquals(100L, wallet.getLifetimeRefundedCents());
    }

    @Test
    void insufficientAggregateBalanceNeverGoesNegativeAndBecomesDebt() {
        ResumeViewOrder order = order(MarketplaceOrderStatus.PAID);
        CreatorEarning earning = earning(CreatorEarningStatus.AVAILABLE, 100, 0);
        CreatorWallet wallet = wallet(0, 20, 0, 0);
        stubLedger(order, entitlement(), earning, wallet);

        service.applyProviderFullRefund("PR-1", LocalDateTime.now());

        assertEquals(0L, wallet.getAvailableBalanceCents());
        assertEquals(80L, wallet.getDebtBalanceCents());
    }

    @Test
    void repeatedProviderRefundIsIdempotent() {
        ResumeViewOrder order = order(MarketplaceOrderStatus.PAID);
        CreatorEarning earning = earning(CreatorEarningStatus.HOLDING, 100, 0);
        CreatorWallet wallet = wallet(100, 0, 0, 0);
        stubLedger(order, entitlement(), earning, wallet);

        service.applyProviderFullRefund("PR-1", LocalDateTime.now());
        service.applyProviderFullRefund("PR-1", LocalDateTime.now());

        assertEquals(100L, wallet.getLifetimeRefundedCents());
        verify(walletMapper, times(1)).updateById(wallet);
        verify(earningMapper, times(1)).updateById(earning);
    }

    @Test
    void anomalyRefundWithNoEarningDoesNotTouchCreatorWallet() {
        ResumeViewOrder order = order(MarketplaceOrderStatus.DUPLICATE_PAID);
        when(orderMapper.selectByOrderNoForUpdate("PR-1")).thenReturn(order);
        when(entitlementMapper.selectBySourceOrderIdForUpdate(10L)).thenReturn(null);
        when(earningMapper.selectByOrderIdForUpdate(10L)).thenReturn(null);

        service.confirmManualFullRefund(
                "PR-1", 99L, "WX-REFUND-1", "微信商户平台已全额退款");

        assertEquals(MarketplaceOrderStatus.REFUNDED.name(), order.getOrderStatus());
        assertEquals("WX-REFUND-1", order.getRefundReference());
        verify(walletMapper, never()).ensureWallet(any());
    }

    @Test
    void ordinaryPaidOrderCanBeConfirmedAfterExternalFullRefund() {
        ResumeViewOrder order = order(MarketplaceOrderStatus.PAID);
        CreatorEarning earning = earning(CreatorEarningStatus.PENDING_SETTLEMENT, 100, 0);
        CreatorWallet wallet = wallet(0, 0, 100, 0);
        stubLedger(order, entitlement(), earning, wallet);

        service.confirmManualFullRefund(
                "PR-1", 99L, "WX-REFUND-1", "微信商户平台已全额退款");

        assertEquals(0L, wallet.getPendingBalanceCents());
        assertEquals(0L, wallet.getDebtBalanceCents());
        assertEquals(99L, order.getRefundResolvedBy());
        assertEquals("WX-REFUND-1", order.getRefundReference());
    }

    @Test
    void manualRefundReferenceCannotBeReusedAcrossOrders() {
        ResumeViewOrder order = order(MarketplaceOrderStatus.PAID);
        ResumeViewOrder other = order(MarketplaceOrderStatus.REFUNDED);
        other.setId(11L);
        when(orderMapper.selectByOrderNoForUpdate("PR-1")).thenReturn(order);
        when(orderMapper.selectByProviderRefundReference("wechat", "WX-REFUND-1"))
                .thenReturn(other);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.confirmManualFullRefund(
                        "PR-1", 99L, "WX-REFUND-1", "微信商户平台已全额退款"));

        assertEquals(ResultCode.PAYMENT_REFUND_REFERENCE_CONFLICT.getCode(), exception.getCode());
        verify(orderMapper, never()).updateById(order);
    }

    @Test
    void genericWechatRefundStateRequiresReviewWithoutMutatingLedger() {
        ResumeViewOrder order = order(MarketplaceOrderStatus.PAID);
        CreatorEarning earning = earning(CreatorEarningStatus.AVAILABLE, 100, 0);
        when(orderMapper.selectByOrderNoForUpdate("PR-1")).thenReturn(order);
        when(earningMapper.selectByOrderIdForUpdate(10L)).thenReturn(earning);
        ProviderPaymentResult refundInProgress = new ProviderPaymentResult(
                PaymentProviderState.REFUND_PENDING_VERIFICATION,
                "PR-1", "TX-1", "app", "mch", "CNY", 100, LocalDateTime.now());

        service.markProviderRefundNeedsVerification(
                "PR-1", refundInProgress, LocalDateTime.now());

        assertEquals(MarketplaceOrderStatus.REFUND_REQUIRED.name(), order.getOrderStatus());
        assertEquals("PROVIDER_REFUND_REQUIRES_FULL_AMOUNT_VERIFICATION",
                order.getPaymentReviewReason());
        assertEquals(CreatorEarningStatus.AVAILABLE.name(), earning.getEarningStatus());
        verify(walletMapper, never()).ensureWallet(any());
        verify(earningMapper, never()).updateById(earning);
    }

    private void stubLedger(ResumeViewOrder order, ResumeViewEntitlement entitlement,
                            CreatorEarning earning, CreatorWallet wallet) {
        when(orderMapper.selectByOrderNoForUpdate("PR-1")).thenReturn(order);
        when(entitlementMapper.selectBySourceOrderIdForUpdate(10L)).thenReturn(entitlement);
        when(earningMapper.selectByOrderIdForUpdate(10L)).thenReturn(earning);
        when(walletMapper.selectByUserIdForUpdate(8L)).thenReturn(wallet);
    }

    private ResumeViewOrder order(MarketplaceOrderStatus status) {
        ResumeViewOrder order = new ResumeViewOrder();
        order.setId(10L);
        order.setOrderNo("PR-1");
        order.setBuyerUserId(7L);
        order.setSellerUserId(8L);
        order.setListingId(1L);
        order.setListingRevisionId(20L);
        order.setProvider("wechat");
        order.setAmountCents(100);
        order.setSellerIncomeCents(100);
        order.setOrderStatus(status.name());
        return order;
    }

    private ResumeViewEntitlement entitlement() {
        ResumeViewEntitlement entitlement = new ResumeViewEntitlement();
        entitlement.setId(20L);
        entitlement.setSourceOrderId(10L);
        entitlement.setEntitlementStatus("ACTIVE");
        return entitlement;
    }

    private CreatorEarning earning(CreatorEarningStatus status, int walletCredit, int debtOffset) {
        CreatorEarning earning = new CreatorEarning();
        earning.setId(30L);
        earning.setSellerUserId(8L);
        earning.setOrderId(10L);
        earning.setNetAmountCents(walletCredit + debtOffset);
        earning.setWalletCreditCents(walletCredit);
        earning.setDebtOffsetCents(debtOffset);
        earning.setEarningStatus(status.name());
        return earning;
    }

    private CreatorWallet wallet(long held, long available, long pending, long debt) {
        CreatorWallet wallet = new CreatorWallet();
        wallet.setUserId(8L);
        wallet.setHeldBalanceCents(held);
        wallet.setAvailableBalanceCents(available);
        wallet.setPendingBalanceCents(pending);
        wallet.setDebtBalanceCents(debt);
        wallet.setLifetimeEarnedCents(100L);
        wallet.setLifetimeRefundedCents(0L);
        wallet.setPaidOutCents(0L);
        wallet.setVersion(0);
        return wallet;
    }
}
