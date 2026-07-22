package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.entity.ResumeMarketListing;
import com.itwanger.pairesume.entity.CreatorEarning;
import com.itwanger.pairesume.entity.CreatorWallet;
import com.itwanger.pairesume.entity.ResumeViewEntitlement;
import com.itwanger.pairesume.entity.ResumeViewOrder;
import com.itwanger.pairesume.mapper.CreatorEarningMapper;
import com.itwanger.pairesume.mapper.CreatorWalletMapper;
import com.itwanger.pairesume.mapper.ResumeMarketListingMapper;
import com.itwanger.pairesume.mapper.ResumeViewEntitlementMapper;
import com.itwanger.pairesume.mapper.ResumeViewOrderMapper;
import com.itwanger.pairesume.payment.MarketplaceOrderStatus;
import com.itwanger.pairesume.payment.CreatorEarningStatus;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.payment.MarketplacePaymentVerifier;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MarketplaceOrderSettlementServiceTest {
    @Mock private ResumeViewOrderMapper orderMapper;
    @Mock private ResumeMarketListingMapper listingMapper;
    @Mock private ResumeViewEntitlementMapper entitlementMapper;
    @Mock private CreatorEarningMapper earningMapper;
    @Mock private CreatorWalletMapper walletMapper;
    @Mock private MarketplacePaymentVerifier verifier;

    private MarketplaceOrderSettlementService service;
    private ResumeViewOrder order;
    private ProviderPaymentResult paid;

    @BeforeEach
    void setUp() {
        service = new MarketplaceOrderSettlementService(orderMapper, listingMapper,
                entitlementMapper, earningMapper, walletMapper, verifier,
                new MarketplacePaymentProperties());
        order = new ResumeViewOrder();
        order.setId(10L);
        order.setOrderNo("PR-1");
        order.setBuyerUserId(7L);
        order.setSellerUserId(8L);
        order.setListingId(1L);
        order.setListingRevisionId(20L);
        order.setAmountCents(1000);
        order.setPlatformFeeCents(0);
        order.setSellerIncomeCents(1000);
        order.setProvider("wechat");
        order.setOrderStatus(MarketplaceOrderStatus.PENDING.name());
        order.setActiveOrderKey("1:7");
        paid = new ProviderPaymentResult(PaymentProviderState.PAID, "PR-1", "TX-1",
                "app", "mch", "CNY", 1000, LocalDateTime.now());

        ResumeMarketListing listing = new ResumeMarketListing();
        listing.setId(1L);
        listing.setPublicationStatus("PUBLISHED");
        listing.setModerationStatus("APPROVED");
        listing.setAccessType("PAID");
        listing.setCurrentRevisionId(20L);
        when(orderMapper.selectByOrderNo("PR-1")).thenReturn(order);
        when(orderMapper.selectByOrderNoForUpdate("PR-1")).thenReturn(order);
        when(listingMapper.selectByIdForUpdate(1L)).thenReturn(listing);
    }

    @Test
    void duplicateCallbackCreditsSellerExactlyOnce() {
        when(entitlementMapper.selectByListingAndBuyerForUpdate(1L, 7L)).thenReturn(null);
        when(earningMapper.selectByOrderId(10L)).thenReturn(null);
        when(walletMapper.selectByUserIdForUpdate(8L)).thenReturn(wallet(0L, 0L));

        service.settlePaidOrder("PR-1", paid);
        service.settlePaidOrder("PR-1", paid);

        assertEquals(MarketplaceOrderStatus.PAID.name(), order.getOrderStatus());
        assertNotNull(order.getProviderReconciledAt());
        verify(entitlementMapper, times(1)).insert(any(ResumeViewEntitlement.class));
        verify(earningMapper, times(1)).insert(any(CreatorEarning.class));
        verify(walletMapper, times(1)).ensureWallet(8L);
        verify(walletMapper, times(1)).updateById(any(CreatorWallet.class));
    }

    @Test
    void signedNotificationAndReplayCannotCertifyEndOfHoldProviderState() {
        when(entitlementMapper.selectByListingAndBuyerForUpdate(1L, 7L)).thenReturn(null);
        when(earningMapper.selectByOrderId(10L)).thenReturn(null);
        when(walletMapper.selectByUserIdForUpdate(8L)).thenReturn(wallet(0L, 0L));

        service.settlePaidNotification("PR-1", paid);
        service.settlePaidNotification("PR-1", paid);

        assertEquals(MarketplaceOrderStatus.PAID.name(), order.getOrderStatus());
        assertNull(order.getProviderReconciledAt());
        assertNull(order.getLastCheckedAt());
        verify(entitlementMapper, times(1)).insert(any(ResumeViewEntitlement.class));
        verify(earningMapper, times(1)).insert(any(CreatorEarning.class));
    }

    @Test
    void delayedOldPaymentAfterAnotherOrderGrantedAccessIsFlaggedWithoutSecondCredit() {
        ResumeViewEntitlement newerEntitlement = new ResumeViewEntitlement();
        newerEntitlement.setSourceOrderId(99L);
        newerEntitlement.setEntitlementStatus("ACTIVE");
        when(entitlementMapper.selectByListingAndBuyerForUpdate(1L, 7L)).thenReturn(newerEntitlement);

        service.settlePaidOrder("PR-1", paid);

        assertEquals(MarketplaceOrderStatus.DUPLICATE_PAID.name(), order.getOrderStatus());
        assertEquals("TX-1", order.getProviderTransactionId());
        verify(earningMapper, never()).insert(any(CreatorEarning.class));
        verify(walletMapper, never()).ensureWallet(anyLong());
    }

    @Test
    void paidCallbackForUnavailableListingRequiresRefundWithoutGrantingAccessOrIncome() {
        ResumeMarketListing unpublished = new ResumeMarketListing();
        unpublished.setId(1L);
        unpublished.setPublicationStatus("UNPUBLISHED");
        unpublished.setModerationStatus("APPROVED");
        unpublished.setAccessType("PAID");
        when(listingMapper.selectByIdForUpdate(1L)).thenReturn(unpublished);

        service.settlePaidOrder("PR-1", paid);

        assertEquals(MarketplaceOrderStatus.REFUND_REQUIRED.name(), order.getOrderStatus());
        assertEquals("TX-1", order.getProviderTransactionId());
        assertNotNull(order.getProviderReconciledAt());
        verify(entitlementMapper, never()).insert(any(ResumeViewEntitlement.class));
        verify(earningMapper, never()).insert(any(CreatorEarning.class));
        verify(walletMapper, never()).ensureWallet(anyLong());
    }

    @Test
    void paymentCompletedBeforeAuthorCutoffStillFulfillsImmutableRevision() {
        order.setSaleClosedAt(paid.paidAt().plusSeconds(1));
        order.setSaleCloseReason("AUTHOR_UNPUBLISH");
        ResumeMarketListing unpublished = new ResumeMarketListing();
        unpublished.setId(1L);
        unpublished.setPublicationStatus("UNPUBLISHED");
        unpublished.setModerationStatus("APPROVED");
        unpublished.setAccessType("PAID");
        unpublished.setCurrentRevisionId(99L);
        when(listingMapper.selectByIdForUpdate(1L)).thenReturn(unpublished);
        when(entitlementMapper.selectByListingAndBuyerForUpdate(1L, 7L)).thenReturn(null);
        when(earningMapper.selectByOrderId(10L)).thenReturn(null);
        when(walletMapper.selectByUserIdForUpdate(8L)).thenReturn(wallet(0L, 0L));

        service.settlePaidOrder("PR-1", paid);

        assertEquals(MarketplaceOrderStatus.PAID.name(), order.getOrderStatus());
        verify(entitlementMapper).insert(any(ResumeViewEntitlement.class));
        verify(walletMapper).ensureWallet(8L);
    }

    @Test
    void paymentCompletedAfterCutoffRequiresRefund() {
        order.setSaleClosedAt(paid.paidAt().minusSeconds(1));
        order.setSaleCloseReason("REVISION_REPLACED");

        service.settlePaidOrder("PR-1", paid);

        assertEquals(MarketplaceOrderStatus.REFUND_REQUIRED.name(), order.getOrderStatus());
        assertEquals("SALE_CLOSED_REVISION_REPLACED", order.getPaymentReviewReason());
        verify(walletMapper, never()).ensureWallet(anyLong());
    }

    @Test
    void currentModerationSuspensionAlwaysRequiresRefundEvenBeforeEarlierAuthorCutoff() {
        order.setSaleClosedAt(paid.paidAt().plusSeconds(1));
        order.setSaleCloseReason("AUTHOR_UNPUBLISH");
        ResumeMarketListing suspended = new ResumeMarketListing();
        suspended.setId(1L);
        suspended.setPublicationStatus("UNPUBLISHED");
        suspended.setModerationStatus("SUSPENDED");
        suspended.setAccessType("PAID");
        when(listingMapper.selectByIdForUpdate(1L)).thenReturn(suspended);

        service.settlePaidOrder("PR-1", paid);

        assertEquals(MarketplaceOrderStatus.REFUND_REQUIRED.name(), order.getOrderStatus());
        verify(walletMapper, never()).ensureWallet(anyLong());
    }

    @Test
    void revokedEntitlementForSameOrderBecomesRefundReviewInsteadOfCallbackLoop() {
        ResumeViewEntitlement revoked = new ResumeViewEntitlement();
        revoked.setId(30L);
        revoked.setSourceOrderId(10L);
        revoked.setEntitlementStatus("REVOKED");
        when(entitlementMapper.selectByListingAndBuyerForUpdate(1L, 7L)).thenReturn(revoked);

        service.settlePaidOrder("PR-1", paid);

        assertEquals(MarketplaceOrderStatus.REFUND_REQUIRED.name(), order.getOrderStatus());
        assertEquals("ENTITLEMENT_REVOKED_WITHOUT_REFUNDED_SOURCE", order.getPaymentReviewReason());
        verify(walletMapper, never()).ensureWallet(anyLong());
    }

    @Test
    void delayedSuccessAfterManualRefundCanNeverResurrectEntitlementOrIncome() {
        order.setOrderStatus(MarketplaceOrderStatus.REFUNDED.name());
        order.setProviderTransactionId("TX-1");

        service.settlePaidOrder("PR-1", paid);

        assertEquals(MarketplaceOrderStatus.REFUNDED.name(), order.getOrderStatus());
        verify(entitlementMapper, never()).insert(any(ResumeViewEntitlement.class));
        verify(earningMapper, never()).insert(any(CreatorEarning.class));
        verify(walletMapper, never()).ensureWallet(anyLong());
    }

    @Test
    void newIncomeOffsetsRefundDebtBeforeEnteringHoldBalance() {
        when(entitlementMapper.selectByListingAndBuyerForUpdate(1L, 7L)).thenReturn(null);
        when(earningMapper.selectByOrderId(10L)).thenReturn(null);
        CreatorWallet wallet = wallet(50L, 600L);
        wallet.setLifetimeEarnedCents(100L);
        when(walletMapper.selectByUserIdForUpdate(8L)).thenReturn(wallet);

        service.settlePaidOrder("PR-1", paid);

        assertEquals(450L, wallet.getHeldBalanceCents());
        assertEquals(0L, wallet.getDebtBalanceCents());
        assertEquals(1100L, wallet.getLifetimeEarnedCents());
        ArgumentCaptor<CreatorEarning> earningCaptor = ArgumentCaptor.forClass(CreatorEarning.class);
        verify(earningMapper).insert(earningCaptor.capture());
        CreatorEarning earning = earningCaptor.getValue();
        assertEquals(400, earning.getWalletCreditCents());
        assertEquals(600, earning.getDebtOffsetCents());
        assertEquals(CreatorEarningStatus.HOLDING.name(), earning.getEarningStatus());
        assertEquals(paid.paidAt().plusDays(7), earning.getAvailableAt());
    }

    @Test
    void confirmedRefundedBuyerCanRepurchaseAndReactivateEntitlement() {
        ResumeViewEntitlement revoked = new ResumeViewEntitlement();
        revoked.setId(30L);
        revoked.setListingId(1L);
        revoked.setBuyerUserId(7L);
        revoked.setListingRevisionId(19L);
        revoked.setSourceOrderId(9L);
        revoked.setEntitlementStatus("REVOKED");
        revoked.setRevokedAt(LocalDateTime.now().minusDays(1));
        revoked.setRevokeReason("PROVIDER_CONFIRMED_FULL_REFUND");
        ResumeViewOrder refundedSource = new ResumeViewOrder();
        refundedSource.setId(9L);
        refundedSource.setOrderStatus(MarketplaceOrderStatus.REFUNDED.name());
        when(entitlementMapper.selectByListingAndBuyerForUpdate(1L, 7L)).thenReturn(revoked);
        when(orderMapper.selectById(9L)).thenReturn(refundedSource);
        when(earningMapper.selectByOrderId(10L)).thenReturn(null);
        when(walletMapper.selectByUserIdForUpdate(8L)).thenReturn(wallet(0L, 0L));

        service.settlePaidOrder("PR-1", paid);

        assertEquals(MarketplaceOrderStatus.PAID.name(), order.getOrderStatus());
        assertEquals("ACTIVE", revoked.getEntitlementStatus());
        assertEquals(20L, revoked.getListingRevisionId());
        assertEquals(10L, revoked.getSourceOrderId());
        assertEquals(null, revoked.getRevokedAt());
        assertEquals(null, revoked.getRevokeReason());
        verify(entitlementMapper).updateById(revoked);
        verify(earningMapper).insert(any(CreatorEarning.class));
    }

    @Test
    void oldRefundedOrderReplayCannotTouchReactivatedEntitlement() {
        order.setOrderStatus(MarketplaceOrderStatus.REFUNDED.name());
        order.setProviderTransactionId("TX-1");
        ResumeViewEntitlement reactivated = new ResumeViewEntitlement();
        reactivated.setId(30L);
        reactivated.setSourceOrderId(99L);
        reactivated.setEntitlementStatus("ACTIVE");

        service.settlePaidOrder("PR-1", paid);

        assertEquals("ACTIVE", reactivated.getEntitlementStatus());
        assertEquals(99L, reactivated.getSourceOrderId());
        verify(entitlementMapper, never()).selectByListingAndBuyerForUpdate(anyLong(), anyLong());
        verify(entitlementMapper, never()).updateById(any(ResumeViewEntitlement.class));
    }

    private CreatorWallet wallet(long held, long debt) {
        CreatorWallet wallet = new CreatorWallet();
        wallet.setUserId(8L);
        wallet.setHeldBalanceCents(held);
        wallet.setAvailableBalanceCents(0L);
        wallet.setPendingBalanceCents(0L);
        wallet.setDebtBalanceCents(debt);
        wallet.setLifetimeEarnedCents(0L);
        wallet.setLifetimeRefundedCents(0L);
        wallet.setPaidOutCents(0L);
        wallet.setVersion(0);
        return wallet;
    }
}
