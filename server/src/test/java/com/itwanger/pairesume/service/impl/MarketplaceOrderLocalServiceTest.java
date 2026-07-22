package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.TableField;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.entity.ResumeMarketListing;
import com.itwanger.pairesume.entity.ResumeMarketListingRevision;
import com.itwanger.pairesume.entity.ResumeViewOrder;
import com.itwanger.pairesume.entity.ResumeViewEntitlement;
import com.itwanger.pairesume.mapper.ResumeMarketListingMapper;
import com.itwanger.pairesume.mapper.ResumeMarketListingRevisionMapper;
import com.itwanger.pairesume.mapper.ResumeViewEntitlementMapper;
import com.itwanger.pairesume.mapper.ResumeViewOrderMapper;
import com.itwanger.pairesume.payment.MarketplaceOrderStatus;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.payment.MarketplacePaymentVerifier;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MarketplaceOrderLocalServiceTest {
    @Mock private ResumeMarketListingMapper listingMapper;
    @Mock private ResumeMarketListingRevisionMapper revisionMapper;
    @Mock private ResumeViewOrderMapper orderMapper;
    @Mock private ResumeViewEntitlementMapper entitlementMapper;
    @Mock private MarketplacePaymentVerifier paymentVerifier;
    @Mock private MarketplaceRefundReversalService refundReversalService;

    private MarketplaceOrderLocalService service;

    @BeforeEach
    void setUp() {
        MarketplacePaymentProperties properties = new MarketplacePaymentProperties();
        service = new MarketplaceOrderLocalService(listingMapper, revisionMapper, orderMapper,
                entitlementMapper, properties, paymentVerifier, refundReversalService);
    }

    @Test
    void reusesOrderForSameBuyerAndIdempotencyKey() {
        ResumeMarketListing listing = paidListing();
        ResumeMarketListingRevision revision = paidRevision();
        ResumeViewOrder existing = order(10L, MarketplaceOrderStatus.PENDING, LocalDateTime.now().plusMinutes(5));
        when(listingMapper.selectOne(any())).thenReturn(listing);
        when(revisionMapper.selectById(20L)).thenReturn(revision);
        when(orderMapper.selectByIdempotencyKey(7L, "idem-key-123")).thenReturn(existing);

        MarketplaceOrderDecision decision = service.findOrCreate(
                "listing", 7L, false, "idem-key-123", "wechat", "WECHAT_NATIVE", true);

        assertEquals(existing.getId(), decision.order().getId());
        verify(orderMapper, never()).insert(any(ResumeViewOrder.class));
    }

    @Test
    void terminalNullFieldsUseAlwaysUpdateStrategy() throws NoSuchFieldException {
        TableField activeOrderKey = ResumeViewOrder.class
                .getDeclaredField("activeOrderKey")
                .getAnnotation(TableField.class);
        TableField revokedAt = ResumeViewEntitlement.class
                .getDeclaredField("revokedAt")
                .getAnnotation(TableField.class);
        TableField revokeReason = ResumeViewEntitlement.class
                .getDeclaredField("revokeReason")
                .getAnnotation(TableField.class);

        assertEquals(FieldStrategy.ALWAYS, activeOrderKey.updateStrategy());
        assertEquals(FieldStrategy.ALWAYS, revokedAt.updateStrategy());
        assertEquals(FieldStrategy.ALWAYS, revokeReason.updateStrategy());
    }

    @Test
    void localExpiryKeepsReservationUntilProviderConfirmsTerminalState() {
        ResumeMarketListing listing = paidListing();
        ResumeMarketListingRevision revision = paidRevision();
        ResumeViewOrder existing = order(10L, MarketplaceOrderStatus.PENDING, LocalDateTime.now().minusSeconds(1));
        existing.setActiveOrderKey("1:7");
        when(listingMapper.selectOne(any())).thenReturn(listing);
        when(revisionMapper.selectById(20L)).thenReturn(revision);
        when(orderMapper.selectByIdempotencyKey(7L, "idem-key-123")).thenReturn(existing);

        MarketplaceOrderDecision decision = service.findOrCreate(
                "listing", 7L, false, "idem-key-123", "wechat", "WECHAT_NATIVE", true);

        assertEquals(MarketplaceOrderStatus.EXPIRED.name(), decision.order().getOrderStatus());
        assertEquals("1:7", decision.order().getActiveOrderKey());
        verify(orderMapper).updateById(existing);
        verify(orderMapper, never()).insert(any(ResumeViewOrder.class));
    }

    @Test
    void deniesOrderReadToAnotherBuyer() {
        ResumeViewOrder existing = order(10L, MarketplaceOrderStatus.PENDING, LocalDateTime.now().plusMinutes(5));
        existing.setBuyerUserId(7L);
        when(orderMapper.selectOne(any())).thenReturn(existing);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.getAuthorizedOrder("PR-1", 8L, false));

        assertEquals(ResultCode.MARKET_ORDER_FORBIDDEN.getCode(), exception.getCode());
    }

    @Test
    void remotePrepayReturningAfterRevisionChangeNeverExposesStaleQrCode() {
        ResumeViewOrder prepaying = order(
                10L, MarketplaceOrderStatus.PREPAYING, LocalDateTime.now().plusMinutes(5));
        prepaying.setActiveOrderKey("1:7");
        prepaying.setSaleClosedAt(LocalDateTime.now());
        prepaying.setSaleCloseReason("REVISION_REPLACED");
        ResumeMarketListing listing = paidListing();
        listing.setCurrentRevisionId(21L);
        when(orderMapper.selectById(10L)).thenReturn(prepaying);
        when(listingMapper.selectByIdForUpdate(1L)).thenReturn(listing);
        when(orderMapper.selectByIdForUpdate(10L)).thenReturn(prepaying);

        ResumeViewOrder stored = service.storePrepay(
                10L, null, "weixin://wxpay/stale", LocalDateTime.now().plusMinutes(5));

        assertEquals(MarketplaceOrderStatus.PREPAY_UNKNOWN.name(), stored.getOrderStatus());
        assertEquals(null, stored.getCodeUrl());
        assertEquals("1:7", stored.getActiveOrderKey());
    }

    @Test
    void staleNonPaidQueryCannotOverwriteRefundReviewTerminalState() {
        ResumeViewOrder review = order(
                10L, MarketplaceOrderStatus.REFUND_REQUIRED, LocalDateTime.now().plusMinutes(5));
        review.setProvider("wechat");
        review.setAmountCents(990);
        review.setProviderTransactionId("TX-1");
        when(orderMapper.selectByOrderNoForUpdate("PR-1")).thenReturn(review);
        ProviderPaymentResult staleClosed = new ProviderPaymentResult(
                PaymentProviderState.CLOSED, "PR-1", null,
                "app", "mch", "CNY", 990, null);

        service.applyNonPaidProviderResult("PR-1", staleClosed);

        assertEquals(MarketplaceOrderStatus.REFUND_REQUIRED.name(), review.getOrderStatus());
        assertEquals(null, review.getProviderReconciledAt());
        assertTrue(review.getLastCheckedAt() != null);
        verify(orderMapper).updateById(review);
    }

    @Test
    void providerRefundForPaidOrderUsesAccountingReversalBoundary() {
        ResumeViewOrder paid = order(
                10L, MarketplaceOrderStatus.PAID, LocalDateTime.now().plusMinutes(5));
        paid.setOrderNo("PR-1");
        paid.setProvider("wechat");
        paid.setAmountCents(990);
        ResumeViewOrder refunded = order(
                10L, MarketplaceOrderStatus.REFUNDED, LocalDateTime.now().plusMinutes(5));
        when(orderMapper.selectByOrderNoForUpdate("PR-1")).thenReturn(paid);
        when(refundReversalService.applyProviderFullRefund(
                org.mockito.ArgumentMatchers.eq("PR-1"), any(LocalDateTime.class)))
                .thenReturn(refunded);
        ProviderPaymentResult providerRefund = new ProviderPaymentResult(
                PaymentProviderState.REFUNDED, "PR-1", "TX-1",
                "app", "mch", "CNY", 990, null);

        ResumeViewOrder result = service.applyNonPaidProviderResult("PR-1", providerRefund);

        assertEquals(MarketplaceOrderStatus.REFUNDED.name(), result.getOrderStatus());
        verify(refundReversalService).applyProviderFullRefund(
                org.mockito.ArgumentMatchers.eq("PR-1"), any(LocalDateTime.class));
    }

    @Test
    void providerPendingResultForOpenOrderRecordsSuccessfulReconciliation() {
        ResumeViewOrder pending = order(
                10L, MarketplaceOrderStatus.PENDING, LocalDateTime.now().plusMinutes(5));
        pending.setOrderNo("PR-1");
        pending.setProvider("wechat");
        pending.setAmountCents(990);
        when(orderMapper.selectByOrderNoForUpdate("PR-1")).thenReturn(pending);
        ProviderPaymentResult providerPending = new ProviderPaymentResult(
                PaymentProviderState.PENDING, "PR-1", null,
                "app", "mch", "CNY", 990, null);

        ResumeViewOrder result = service.applyNonPaidProviderResult("PR-1", providerPending);

        assertEquals(MarketplaceOrderStatus.PENDING.name(), result.getOrderStatus());
        assertTrue(result.getProviderReconciledAt() != null);
        verify(orderMapper).updateById(pending);
    }

    @Test
    void nonRefundProviderStateNeverDowngradesPaidOrder() {
        ResumeViewOrder paid = order(
                10L, MarketplaceOrderStatus.PAID, LocalDateTime.now().plusMinutes(5));
        paid.setOrderNo("PR-1");
        paid.setProvider("wechat");
        paid.setAmountCents(990);
        when(orderMapper.selectByOrderNoForUpdate("PR-1")).thenReturn(paid);
        ProviderPaymentResult providerClosed = new ProviderPaymentResult(
                PaymentProviderState.CLOSED, "PR-1", null,
                "app", "mch", "CNY", 990, null);

        ResumeViewOrder result = service.applyNonPaidProviderResult("PR-1", providerClosed);

        assertEquals(MarketplaceOrderStatus.PAID.name(), result.getOrderStatus());
        assertEquals(null, paid.getProviderReconciledAt());
        assertTrue(paid.getLastCheckedAt() != null);
        verify(orderMapper).updateById(paid);
        verify(refundReversalService, never()).applyProviderFullRefund(
                org.mockito.ArgumentMatchers.anyString(), any(LocalDateTime.class));
    }

    private ResumeMarketListing paidListing() {
        ResumeMarketListing listing = new ResumeMarketListing();
        listing.setId(1L);
        listing.setSellerUserId(2L);
        listing.setSlug("listing");
        listing.setAccessType("PAID");
        listing.setPublicationStatus("PUBLISHED");
        listing.setModerationStatus("APPROVED");
        listing.setCurrentRevisionId(20L);
        return listing;
    }

    private ResumeMarketListingRevision paidRevision() {
        ResumeMarketListingRevision revision = new ResumeMarketListingRevision();
        revision.setId(20L);
        revision.setListingId(1L);
        revision.setAccessTypeSnapshot("PAID");
        revision.setPriceCentsSnapshot(990);
        return revision;
    }

    private ResumeViewOrder order(Long id, MarketplaceOrderStatus status, LocalDateTime expiresAt) {
        ResumeViewOrder order = new ResumeViewOrder();
        order.setId(id);
        order.setListingId(1L);
        order.setListingRevisionId(20L);
        order.setBuyerUserId(7L);
        order.setOrderStatus(status.name());
        order.setExpiresAt(expiresAt);
        return order;
    }
}
