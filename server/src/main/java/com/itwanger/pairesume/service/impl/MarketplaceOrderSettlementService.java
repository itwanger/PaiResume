package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.entity.CreatorEarning;
import com.itwanger.pairesume.entity.CreatorWallet;
import com.itwanger.pairesume.entity.ResumeMarketListing;
import com.itwanger.pairesume.entity.ResumeViewEntitlement;
import com.itwanger.pairesume.entity.ResumeViewOrder;
import com.itwanger.pairesume.mapper.CreatorEarningMapper;
import com.itwanger.pairesume.mapper.CreatorWalletMapper;
import com.itwanger.pairesume.mapper.ResumeMarketListingMapper;
import com.itwanger.pairesume.mapper.ResumeViewEntitlementMapper;
import com.itwanger.pairesume.mapper.ResumeViewOrderMapper;
import com.itwanger.pairesume.payment.CreatorEarningStatus;
import com.itwanger.pairesume.payment.MarketplaceOrderStatus;
import com.itwanger.pairesume.payment.MarketplacePaymentVerifier;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Owns the single atomic transition from a verified provider payment to the
 * marketplace entitlement and creator accounting records.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MarketplaceOrderSettlementService {
    private final ResumeViewOrderMapper orderMapper;
    private final ResumeMarketListingMapper listingMapper;
    private final ResumeViewEntitlementMapper entitlementMapper;
    private final CreatorEarningMapper earningMapper;
    private final CreatorWalletMapper walletMapper;
    private final MarketplacePaymentVerifier paymentVerifier;
    private final MarketplacePaymentProperties paymentProperties;

    @Transactional
    public ResumeViewOrder settlePaidOrder(String orderNo, ProviderPaymentResult payment) {
        return settleVerifiedPaidOrder(orderNo, payment, true);
    }

    /**
     * A signed notification can grant the purchase, but it describes the
     * original payment event and may be delayed or replayed. It must not serve
     * as the fresh end-of-hold provider proof used to release creator income.
     */
    @Transactional
    public ResumeViewOrder settlePaidNotification(String orderNo, ProviderPaymentResult payment) {
        return settleVerifiedPaidOrder(orderNo, payment, false);
    }

    private ResumeViewOrder settleVerifiedPaidOrder(String orderNo, ProviderPaymentResult payment,
                                                     boolean certifyCurrentProviderState) {
        ResumeViewOrder orderSnapshot = orderMapper.selectByOrderNo(orderNo);
        if (orderSnapshot == null) {
            throw new BusinessException(ResultCode.MARKET_ORDER_NOT_FOUND);
        }
        // Keep the marketplace lock order identical to order creation:
        // listing -> order -> entitlement/accounting records.
        ResumeMarketListing listing = listingMapper.selectByIdForUpdate(orderSnapshot.getListingId());
        if (listing == null) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_FOUND);
        }
        ResumeViewOrder order = orderMapper.selectByOrderNoForUpdate(orderNo);
        if (order == null) {
            throw new BusinessException(ResultCode.MARKET_ORDER_NOT_FOUND);
        }
        paymentVerifier.verify(order, payment);
        if (payment.state() != PaymentProviderState.PAID) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }

        if (MarketplaceOrderStatus.PAID.name().equals(order.getOrderStatus())) {
            if (!Objects.equals(order.getProviderTransactionId(), payment.transactionId())) {
                throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
            }
            LocalDateTime reconciledAt = LocalDateTime.now();
            if (certifyCurrentProviderState) {
                order.setLastCheckedAt(reconciledAt);
                order.setProviderReconciledAt(reconciledAt);
            }
            orderMapper.updateById(order);
            return order;
        }
        if (MarketplaceOrderStatus.DUPLICATE_PAID.name().equals(order.getOrderStatus())
                || MarketplaceOrderStatus.REFUND_REQUIRED.name().equals(order.getOrderStatus())
                || MarketplaceOrderStatus.REFUNDED.name().equals(order.getOrderStatus())) {
            if (!Objects.equals(order.getProviderTransactionId(), payment.transactionId())) {
                throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
            }
            LocalDateTime reconciledAt = LocalDateTime.now();
            if (certifyCurrentProviderState) {
                order.setLastCheckedAt(reconciledAt);
                order.setProviderReconciledAt(reconciledAt);
            }
            orderMapper.updateById(order);
            return order;
        }

        ResumeViewOrder transactionOwner = orderMapper.selectByProviderTransaction(
                order.getProvider(), payment.transactionId());
        if (transactionOwner != null && !Objects.equals(transactionOwner.getId(), order.getId())) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }

        LocalDateTime settledAt = payment.paidAt();
        if (!isSaleStillValid(listing, order, payment)) {
            String reviewReason = paymentReviewReason(listing, order);
            markPaymentForReview(order, payment, MarketplaceOrderStatus.REFUND_REQUIRED,
                    reviewReason, certifyCurrentProviderState);
            log.error("Marketplace payment requires manual refund because sale is no longer valid "
                            + "orderNo={}, listingId={}, publicationStatus={}, moderationStatus={}, accessType={}",
                    order.getOrderNo(), listing.getId(), listing.getPublicationStatus(),
                    listing.getModerationStatus(), listing.getAccessType());
            return order;
        }
        ResumeViewEntitlement entitlement = entitlementMapper.selectByListingAndBuyerForUpdate(
                order.getListingId(), order.getBuyerUserId());
        if (entitlement != null && !"ACTIVE".equals(entitlement.getEntitlementStatus())) {
            ResumeViewOrder refundedSource = orderMapper.selectById(entitlement.getSourceOrderId());
            if (refundedSource == null
                    || !MarketplaceOrderStatus.REFUNDED.name().equals(refundedSource.getOrderStatus())) {
                markPaymentForReview(order, payment, MarketplaceOrderStatus.REFUND_REQUIRED,
                        "ENTITLEMENT_REVOKED_WITHOUT_REFUNDED_SOURCE", certifyCurrentProviderState);
                log.error("Marketplace payment requires manual refund because entitlement revocation "
                                + "has no confirmed-refunded source orderNo={}, entitlementId={}",
                        order.getOrderNo(), entitlement.getId());
                return order;
            }
        }
        if (entitlement != null && "ACTIVE".equals(entitlement.getEntitlementStatus())
                && !Objects.equals(entitlement.getSourceOrderId(), order.getId())) {
            markPaymentForReview(order, payment, MarketplaceOrderStatus.DUPLICATE_PAID,
                    "ACTIVE_ENTITLEMENT_OTHER_ORDER", certifyCurrentProviderState);
            log.error("Duplicate marketplace payment requires manual refund orderNo={}, "
                            + "listingId={}, buyerUserId={}, entitlementSourceOrderId={}",
                    order.getOrderNo(), order.getListingId(), order.getBuyerUserId(),
                    entitlement.getSourceOrderId());
            return order;
        }

        order.setOrderStatus(MarketplaceOrderStatus.PAID.name());
        order.setProviderTransactionId(payment.transactionId());
        order.setPaidAt(settledAt);
        if (certifyCurrentProviderState) {
            order.setLastCheckedAt(LocalDateTime.now());
            order.setProviderReconciledAt(order.getLastCheckedAt());
        }
        order.setActiveOrderKey(null);
        orderMapper.updateById(order);

        if (entitlement == null) {
            entitlement = new ResumeViewEntitlement();
            entitlement.setListingId(order.getListingId());
            entitlement.setListingRevisionId(order.getListingRevisionId());
            entitlement.setBuyerUserId(order.getBuyerUserId());
            entitlement.setSourceOrderId(order.getId());
            entitlement.setEntitlementStatus("ACTIVE");
            entitlement.setGrantedAt(settledAt);
            entitlementMapper.insert(entitlement);
        } else if (!"ACTIVE".equals(entitlement.getEntitlementStatus())) {
            // A confirmed refund may be followed by a legitimate repurchase.
            // Reuse the unique entitlement row and point it at the new immutable
            // revision/order. A callback replay for the old REFUNDED order exits
            // at the terminal-state guard above and cannot re-activate it.
            entitlement.setListingRevisionId(order.getListingRevisionId());
            entitlement.setSourceOrderId(order.getId());
            entitlement.setEntitlementStatus("ACTIVE");
            entitlement.setGrantedAt(settledAt);
            entitlement.setRevokedAt(null);
            entitlement.setRevokeReason(null);
            entitlementMapper.updateById(entitlement);
        }

        CreatorEarning earning = earningMapper.selectByOrderId(order.getId());
        if (earning == null) {
            WalletCreditAllocation allocation = creditCreatorWalletHolding(
                    order.getSellerUserId(), order.getSellerIncomeCents());
            earning = new CreatorEarning();
            earning.setSellerUserId(order.getSellerUserId());
            earning.setListingId(order.getListingId());
            earning.setOrderId(order.getId());
            earning.setGrossAmountCents(order.getAmountCents());
            earning.setPlatformFeeCents(order.getPlatformFeeCents());
            earning.setNetAmountCents(order.getSellerIncomeCents());
            earning.setWalletCreditCents(allocation.walletCreditCents());
            earning.setDebtOffsetCents(allocation.debtOffsetCents());
            earning.setEarningStatus(CreatorEarningStatus.HOLDING.name());
            earning.setAvailableAt(settledAt.plusDays(paymentProperties.getCreatorEarningHoldDays()));
            earningMapper.insert(earning);
        }
        return order;
    }

    private WalletCreditAllocation creditCreatorWalletHolding(Long sellerUserId, int netAmountCents) {
        walletMapper.ensureWallet(sellerUserId);
        CreatorWallet wallet = walletMapper.selectByUserIdForUpdate(sellerUserId);
        if (wallet == null) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "作者收益账户创建失败");
        }
        long previousDebt = nonNegative(wallet.getDebtBalanceCents());
        long debtOffset = Math.min(previousDebt, netAmountCents);
        long walletCredit = netAmountCents - debtOffset;
        wallet.setDebtBalanceCents(previousDebt - debtOffset);
        wallet.setHeldBalanceCents(nonNegative(wallet.getHeldBalanceCents()) + walletCredit);
        wallet.setLifetimeEarnedCents(nonNegative(wallet.getLifetimeEarnedCents()) + netAmountCents);
        wallet.setVersion(wallet.getVersion() == null ? 1 : wallet.getVersion() + 1);
        walletMapper.updateById(wallet);
        return new WalletCreditAllocation(
                Math.toIntExact(walletCredit), Math.toIntExact(debtOffset));
    }

    private long nonNegative(Long value) {
        return value == null ? 0L : Math.max(0L, value);
    }

    private record WalletCreditAllocation(int walletCreditCents, int debtOffsetCents) {
    }

    private boolean isSaleStillValid(ResumeMarketListing listing, ResumeViewOrder order,
                                     ProviderPaymentResult payment) {
        if (!"APPROVED".equals(listing.getModerationStatus())) {
            return false;
        }
        if (order.getSaleClosedAt() != null) {
            return !payment.paidAt().isAfter(order.getSaleClosedAt());
        }
        return "PUBLISHED".equals(listing.getPublicationStatus())
                && "APPROVED".equals(listing.getModerationStatus())
                && "PAID".equals(listing.getAccessType())
                && Objects.equals(listing.getCurrentRevisionId(), order.getListingRevisionId());
    }

    private void markPaymentForReview(ResumeViewOrder order, ProviderPaymentResult payment,
                                      MarketplaceOrderStatus status, String reviewReason,
                                      boolean certifyCurrentProviderState) {
        order.setOrderStatus(status.name());
        order.setProviderTransactionId(payment.transactionId());
        order.setPaidAt(payment.paidAt());
        if (certifyCurrentProviderState) {
            order.setLastCheckedAt(LocalDateTime.now());
            order.setProviderReconciledAt(order.getLastCheckedAt());
        }
        order.setActiveOrderKey(null);
        order.setPaymentReviewReason(reviewReason);
        orderMapper.updateById(order);
    }

    private String paymentReviewReason(ResumeMarketListing listing, ResumeViewOrder order) {
        if (!"APPROVED".equals(listing.getModerationStatus())) {
            return "LISTING_NOT_APPROVED";
        }
        if (order.getSaleClosedAt() != null) {
            return "SALE_CLOSED_" + order.getSaleCloseReason();
        }
        if (!"PUBLISHED".equals(listing.getPublicationStatus())) {
            return "LISTING_NOT_PUBLISHED";
        }
        if (!"PAID".equals(listing.getAccessType())) {
            return "LISTING_NOT_PAID";
        }
        return "LISTING_REVISION_CHANGED";
    }
}
