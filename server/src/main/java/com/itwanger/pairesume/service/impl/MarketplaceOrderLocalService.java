package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.entity.ResumeMarketListing;
import com.itwanger.pairesume.entity.ResumeMarketListingRevision;
import com.itwanger.pairesume.entity.ResumeViewEntitlement;
import com.itwanger.pairesume.entity.ResumeViewOrder;
import com.itwanger.pairesume.mapper.ResumeMarketListingMapper;
import com.itwanger.pairesume.mapper.ResumeMarketListingRevisionMapper;
import com.itwanger.pairesume.mapper.ResumeViewEntitlementMapper;
import com.itwanger.pairesume.mapper.ResumeViewOrderMapper;
import com.itwanger.pairesume.payment.MarketplaceOrderStatus;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.payment.MarketplacePaymentVerifier;
import com.itwanger.pairesume.payment.PaymentOrderNoGenerator;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Objects;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MarketplaceOrderLocalService {
    private final ResumeMarketListingMapper listingMapper;
    private final ResumeMarketListingRevisionMapper revisionMapper;
    private final ResumeViewOrderMapper orderMapper;
    private final ResumeViewEntitlementMapper entitlementMapper;
    private final MarketplacePaymentProperties paymentProperties;
    private final MarketplacePaymentVerifier paymentVerifier;
    private final MarketplaceRefundReversalService refundReversalService;

    @Transactional
    public MarketplaceOrderDecision findOrCreate(String slug, Long buyerUserId, boolean admin,
                                                 String idempotencyKey, String provider,
                                                 String payChannel, boolean paymentEnabled) {
        ResumeMarketListing listing = listingMapper.selectOne(
                new LambdaQueryWrapper<ResumeMarketListing>()
                        .eq(ResumeMarketListing::getSlug, slug)
                        .last("LIMIT 1 FOR UPDATE")
        );
        requirePurchasable(listing, buyerUserId, admin);

        ResumeMarketListingRevision revision = revisionMapper.selectById(listing.getCurrentRevisionId());
        if (revision == null || !Objects.equals(revision.getListingId(), listing.getId())) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_FOUND);
        }
        if (!"PAID".equals(revision.getAccessTypeSnapshot())
                || revision.getPriceCentsSnapshot() == null
                || revision.getPriceCentsSnapshot() <= 0) {
            throw new BusinessException(ResultCode.MARKET_PRICE_INVALID);
        }

        ResumeViewEntitlement entitlement = entitlementMapper.selectByListingAndBuyer(listing.getId(), buyerUserId);
        if (entitlement != null && "ACTIVE".equals(entitlement.getEntitlementStatus())) {
            throw new BusinessException(ResultCode.MARKET_ALREADY_UNLOCKED);
        }

        ResumeViewOrder idempotent = orderMapper.selectByIdempotencyKey(buyerUserId, idempotencyKey);
        if (idempotent != null) {
            if (!Objects.equals(idempotent.getListingId(), listing.getId())) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "幂等键已用于其他订单");
            }
            return new MarketplaceOrderDecision(expireIfNecessary(idempotent), revision);
        }

        String activeOrderKey = activeOrderKey(listing.getId(), buyerUserId);
        ResumeViewOrder active = orderMapper.selectByActiveOrderKey(activeOrderKey);
        if (active != null) {
            active = expireIfNecessary(active);
            if (MarketplaceOrderStatus.from(active.getOrderStatus()).isActive()) {
                return new MarketplaceOrderDecision(active, revisionMapper.selectById(active.getListingRevisionId()));
            }
        }

        if (!paymentEnabled) {
            throw new BusinessException(ResultCode.PAYMENT_NOT_ENABLED);
        }

        int amountCents = revision.getPriceCentsSnapshot();
        int feeCents = Math.toIntExact((long) amountCents
                * paymentProperties.getPlatformFeeBasisPoints() / 10_000L);
        ResumeViewOrder order = new ResumeViewOrder();
        order.setOrderNo(PaymentOrderNoGenerator.generate("PR"));
        order.setBuyerUserId(buyerUserId);
        order.setSellerUserId(listing.getSellerUserId());
        order.setListingId(listing.getId());
        order.setListingRevisionId(revision.getId());
        order.setIdempotencyKey(idempotencyKey);
        order.setActiveOrderKey(activeOrderKey);
        order.setAmountCents(amountCents);
        order.setPlatformFeeCents(feeCents);
        order.setSellerIncomeCents(amountCents - feeCents);
        order.setCurrency("CNY");
        order.setProvider(provider);
        order.setPayChannel(payChannel);
        order.setOrderStatus(MarketplaceOrderStatus.CREATED.name());
        order.setExpiresAt(LocalDateTime.now().plusMinutes(paymentProperties.getOrderExpireMinutes()));
        orderMapper.insert(order);
        return new MarketplaceOrderDecision(order, revision);
    }

    @Transactional
    public MarketplaceOrderDecision resolveAfterDuplicate(String slug, Long buyerUserId,
                                                          String idempotencyKey) {
        ResumeMarketListing listing = listingMapper.selectOne(
                new LambdaQueryWrapper<ResumeMarketListing>()
                        .eq(ResumeMarketListing::getSlug, slug)
                        .last("LIMIT 1")
        );
        if (listing == null) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_FOUND);
        }
        ResumeViewOrder order = orderMapper.selectByIdempotencyKey(buyerUserId, idempotencyKey);
        if (order == null) {
            order = orderMapper.selectByActiveOrderKey(activeOrderKey(listing.getId(), buyerUserId));
        }
        if (order == null || !Objects.equals(order.getListingId(), listing.getId())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "并发创建订单失败，请重试");
        }
        order = expireIfNecessary(order);
        return new MarketplaceOrderDecision(order, revisionMapper.selectById(order.getListingRevisionId()));
    }

    @Transactional
    public boolean claimPrepay(Long orderId) {
        return orderMapper.claimPrepay(orderId) == 1;
    }

    @Transactional
    public boolean claimProviderQuery(Long orderId) {
        return orderMapper.claimProviderQuery(orderId) == 1;
    }

    @Transactional
    public ResumeViewOrder storePrepay(Long orderId, String providerPrepayId, String codeUrl,
                                       LocalDateTime expiresAt) {
        ResumeViewOrder snapshot = orderMapper.selectById(orderId);
        if (snapshot == null) {
            throw new BusinessException(ResultCode.MARKET_ORDER_NOT_FOUND);
        }
        ResumeMarketListing listing = listingMapper.selectByIdForUpdate(snapshot.getListingId());
        ResumeViewOrder order = requireOrderForUpdate(orderId);
        if (MarketplaceOrderStatus.PAID.name().equals(order.getOrderStatus())) {
            return order;
        }
        if (!MarketplaceOrderStatus.PREPAYING.name().equals(order.getOrderStatus())) {
            return order;
        }
        if (listing == null || order.getSaleClosedAt() != null
                || !Objects.equals(listing.getCurrentRevisionId(), order.getListingRevisionId())
                || !"PUBLISHED".equals(listing.getPublicationStatus())
                || !"APPROVED".equals(listing.getModerationStatus())
                || !"PAID".equals(listing.getAccessType())) {
            order.setOrderStatus(MarketplaceOrderStatus.PREPAY_UNKNOWN.name());
            orderMapper.updateById(order);
            return order;
        }
        order.setProviderPrepayId(providerPrepayId);
        order.setCodeUrl(codeUrl);
        order.setExpiresAt(expiresAt);
        order.setOrderStatus(MarketplaceOrderStatus.PENDING.name());
        orderMapper.updateById(order);
        return order;
    }

    @Transactional
    public ResumeViewOrder markPrepayUnknown(Long orderId) {
        ResumeViewOrder order = requireOrderForUpdate(orderId);
        if (MarketplaceOrderStatus.PREPAYING.name().equals(order.getOrderStatus())) {
            order.setOrderStatus(MarketplaceOrderStatus.PREPAY_UNKNOWN.name());
            orderMapper.updateById(order);
        }
        return order;
    }

    @Transactional
    public boolean cancelCreatedOrder(Long orderId) {
        return orderMapper.cancelCreatedOrder(orderId) == 1;
    }

    @Transactional
    public boolean recoverStalePrepay(Long orderId) {
        return orderMapper.recoverStalePrepay(orderId) == 1;
    }

    @Transactional
    public void markSaleClosed(Long listingId, Long currentRevisionId, boolean closeAll,
                               LocalDateTime closedAt, String reason) {
        if (closeAll) {
            orderMapper.markAllOpenOrdersSaleClosed(listingId, closedAt, reason);
        } else {
            orderMapper.markOtherRevisionOrdersSaleClosed(
                    listingId, currentRevisionId, closedAt, reason);
        }
    }

    @Transactional(readOnly = true)
    public List<ResumeViewOrder> listSaleClosedProviderOpenBatch() {
        return orderMapper.selectSaleClosedProviderOpenBatch();
    }

    @Transactional(readOnly = true)
    public List<Long> listOpenReconciliationCandidateIds(String provider) {
        return orderMapper.selectOpenReconciliationCandidateIds(provider);
    }

    @Transactional
    public boolean claimOpenOrderReconciliation(Long orderId, String provider, String leaseToken) {
        return orderMapper.claimOpenOrderReconciliation(orderId, provider, leaseToken) == 1;
    }

    @Transactional(readOnly = true)
    public List<Long> listHoldingPaidReconciliationCandidateIds(
            String provider, LocalDateTime reconcileBefore, LocalDateTime dueRetryBefore) {
        return orderMapper.selectHoldingPaidReconciliationCandidateIds(
                provider, reconcileBefore, dueRetryBefore);
    }

    @Transactional
    public boolean claimHoldingPaidReconciliation(Long orderId, String provider,
                                                   LocalDateTime reconcileBefore,
                                                   LocalDateTime dueRetryBefore,
                                                   String leaseToken) {
        return orderMapper.claimHoldingPaidReconciliation(
                orderId, provider, reconcileBefore, dueRetryBefore, leaseToken) == 1;
    }

    @Transactional
    public boolean renewReconciliationLease(Long orderId, String leaseToken) {
        return orderMapper.renewReconciliationLease(orderId, leaseToken) == 1;
    }

    @Transactional
    public boolean expirePendingUnderReconciliationLease(Long orderId, String leaseToken) {
        return orderMapper.expirePendingUnderReconciliationLease(orderId, leaseToken) == 1;
    }

    @Transactional
    public void releaseReconciliationLease(Long orderId, String leaseToken) {
        orderMapper.releaseReconciliationLease(orderId, leaseToken);
    }

    @Transactional
    public ResumeViewOrder getAuthorizedOrder(String orderNo, Long userId, boolean admin) {
        ResumeViewOrder order = orderMapper.selectOne(
                new LambdaQueryWrapper<ResumeViewOrder>()
                        .eq(ResumeViewOrder::getOrderNo, orderNo)
                        .last("LIMIT 1")
        );
        if (order == null) {
            throw new BusinessException(ResultCode.MARKET_ORDER_NOT_FOUND);
        }
        if (!admin && !Objects.equals(order.getBuyerUserId(), userId)) {
            throw new BusinessException(ResultCode.MARKET_ORDER_FORBIDDEN);
        }
        return expireIfNecessary(order);
    }

    @Transactional(readOnly = true)
    public ResumeViewOrder getById(Long id) {
        return orderMapper.selectById(id);
    }

    @Transactional
    public ResumeViewOrder applyNonPaidProviderResult(String orderNo, ProviderPaymentResult result) {
        ResumeViewOrder order = orderMapper.selectByOrderNoForUpdate(orderNo);
        if (order == null) {
            throw new BusinessException(ResultCode.MARKET_ORDER_NOT_FOUND);
        }
        paymentVerifier.verify(order, result);
        LocalDateTime reconciledAt = LocalDateTime.now();
        order.setLastCheckedAt(reconciledAt);
        MarketplaceOrderStatus current = MarketplaceOrderStatus.from(order.getOrderStatus());
        if (result.state() == PaymentProviderState.REFUNDED) {
            if (current == MarketplaceOrderStatus.REFUNDED) {
                orderMapper.updateById(order);
                return order;
            }
            return refundReversalService.applyProviderFullRefund(orderNo, reconciledAt);
        }
        if (result.state() == PaymentProviderState.REFUND_PENDING_VERIFICATION) {
            return refundReversalService.markProviderRefundNeedsVerification(
                    orderNo, result, LocalDateTime.now());
        }
        if (current == MarketplaceOrderStatus.PAID
                || current == MarketplaceOrderStatus.DUPLICATE_PAID
                || current == MarketplaceOrderStatus.REFUND_REQUIRED
                || current == MarketplaceOrderStatus.REFUNDED) {
            // A local PAID order must be re-confirmed as PAID through the paid
            // settlement path before frozen earnings may be released. A
            // contradictory/non-terminal provider state records the attempt
            // only and cannot advance provider_reconciled_at.
            orderMapper.updateById(order);
            return order;
        }
        order.setProviderReconciledAt(reconciledAt);
        if (result.state() == PaymentProviderState.CLOSED) {
            terminate(order, MarketplaceOrderStatus.CLOSED);
        } else if (result.state() == PaymentProviderState.FAILED) {
            terminate(order, MarketplaceOrderStatus.FAILED);
        }
        orderMapper.updateById(order);
        return order;
    }

    private ResumeViewOrder expireIfNecessary(ResumeViewOrder order) {
        MarketplaceOrderStatus status = MarketplaceOrderStatus.from(order.getOrderStatus());
        if (status.isActive() && order.getExpiresAt().isBefore(LocalDateTime.now())) {
            // Local time alone cannot prove that the payment provider has
            // closed the order. Keep active_order_key reserved until a signed
            // callback or provider query reports a terminal state, otherwise a
            // delayed success could race a replacement order and double-charge.
            order.setOrderStatus(MarketplaceOrderStatus.EXPIRED.name());
            order.setClosedAt(LocalDateTime.now());
            orderMapper.updateById(order);
        }
        return order;
    }

    private void terminate(ResumeViewOrder order, MarketplaceOrderStatus status) {
        order.setOrderStatus(status.name());
        order.setActiveOrderKey(null);
        order.setClosedAt(LocalDateTime.now());
    }

    private ResumeViewOrder requireOrderForUpdate(Long id) {
        ResumeViewOrder order = orderMapper.selectByIdForUpdate(id);
        if (order == null) {
            throw new BusinessException(ResultCode.MARKET_ORDER_NOT_FOUND);
        }
        return order;
    }

    private void requirePurchasable(ResumeMarketListing listing, Long buyerUserId, boolean admin) {
        if (listing == null) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_FOUND);
        }
        if (admin || Objects.equals(listing.getSellerUserId(), buyerUserId)
                || "FREE".equals(listing.getAccessType())) {
            throw new BusinessException(ResultCode.MARKET_ALREADY_UNLOCKED);
        }
        if ("SUSPENDED".equals(listing.getModerationStatus())) {
            throw new BusinessException(ResultCode.MARKET_LISTING_SUSPENDED);
        }
        if (!"PUBLISHED".equals(listing.getPublicationStatus())
                || !"APPROVED".equals(listing.getModerationStatus())
                || listing.getCurrentRevisionId() == null) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_PUBLISHED);
        }
    }

    private String activeOrderKey(Long listingId, Long buyerUserId) {
        return listingId + ":" + buyerUserId;
    }
}
