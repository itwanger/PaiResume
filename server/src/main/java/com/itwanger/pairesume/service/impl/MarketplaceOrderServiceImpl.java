package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.MarketplaceFeatureProperties;
import com.itwanger.pairesume.dto.MarketplaceOrderDTO;
import com.itwanger.pairesume.dto.MarketplacePaymentReviewDTO;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.entity.ResumeMarketListing;
import com.itwanger.pairesume.entity.ResumeViewOrder;
import com.itwanger.pairesume.mapper.ResumeMarketListingMapper;
import com.itwanger.pairesume.mapper.ResumeViewOrderMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.payment.MarketplaceOrderStatus;
import com.itwanger.pairesume.payment.MarketplacePaymentGateway;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.payment.PaymentNotificationRequest;
import com.itwanger.pairesume.payment.PaymentPrepayRequest;
import com.itwanger.pairesume.payment.PaymentPrepayResult;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import com.itwanger.pairesume.payment.QrCodeDataUrlGenerator;
import com.itwanger.pairesume.service.MarketplaceOrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Objects;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;

@Slf4j
@Service
@RequiredArgsConstructor
public class MarketplaceOrderServiceImpl implements MarketplaceOrderService {
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private static final String PAYMENT_DESCRIPTION = "PaiResume 付费简历查看";

    private final MarketplaceOrderLocalService localOrderService;
    private final MarketplaceOrderSettlementService settlementService;
    private final MarketplacePaymentGateway paymentGateway;
    private final MarketplacePaymentProperties paymentProperties;
    private final MarketplaceFeatureProperties marketplaceFeatureProperties;
    private final ResumeMarketListingMapper listingMapper;
    private final ResumeViewOrderMapper orderMapper;
    private final UserMapper userMapper;
    private final QrCodeDataUrlGenerator qrCodeGenerator;
    private final MarketplaceRefundReversalService refundReversalService;

    @Override
    public MarketplaceOrderDTO createOrder(String listingSlug, Long buyerUserId, boolean admin,
                                           String idempotencyKey, String clientIp) {
        if (!marketplaceFeatureProperties.isEnabled()
                || !paymentProperties.isMarketplaceAcceptNewOrders()) {
            throw new BusinessException(ResultCode.PAYMENT_NOT_ENABLED);
        }
        MarketplaceOrderDecision decision = findOrCreateDecision(
                listingSlug, buyerUserId, admin, idempotencyKey);
        ResumeViewOrder order = decision.order();
        order = recoverStalePrepayIfNeeded(order);
        MarketplaceOrderStatus status = MarketplaceOrderStatus.from(order.getOrderStatus());
        if (order.getSaleClosedAt() != null) {
            order = reconcileSaleClosedOrder(order);
        } else if (status.requiresProviderCloseBeforeReplacement()) {
            order = reconcileProviderUncertainOrder(order, true);
        }
        if (order.getActiveOrderKey() == null
                && !Objects.equals(order.getIdempotencyKey(), idempotencyKey)
                && !isPaidOrReviewStatus(order)) {
            decision = findOrCreateDecision(listingSlug, buyerUserId, admin, idempotencyKey);
            order = decision.order();
        }

        if (MarketplaceOrderStatus.CREATED.name().equals(order.getOrderStatus())
                && localOrderService.claimPrepay(order.getId())) {
            order = createProviderPrepay(order, clientIp);
        } else if (MarketplaceOrderStatus.PREPAYING.name().equals(order.getOrderStatus())) {
            order = awaitConcurrentPrepay(order.getId());
            if (order.getSaleClosedAt() != null) {
                order = reconcileSaleClosedOrder(order);
            }
        }
        return toDto(order);
    }

    @Override
    public MarketplaceOrderDTO getOrder(String orderNo, Long userId, boolean admin) {
        return toDto(localOrderService.getAuthorizedOrder(orderNo, userId, admin));
    }

    @Override
    public MarketplaceOrderDTO refreshOrder(String orderNo, Long userId, boolean admin) {
        ResumeViewOrder order = localOrderService.getAuthorizedOrder(orderNo, userId, admin);
        order = recoverStalePrepayIfNeeded(order);
        MarketplaceOrderStatus status = MarketplaceOrderStatus.from(order.getOrderStatus());
        if (order.getSaleClosedAt() != null) {
            return toDto(reconcileSaleClosedOrder(order));
        }
        if (!status.isProviderQueryable()) {
            return toDto(order);
        }
        if (status.requiresProviderCloseBeforeReplacement()) {
            return toDto(reconcileProviderUncertainOrder(order, true));
        }

        // The atomic claim prevents concurrent/manual refresh storms without
        // holding a database lock while the provider call is in flight.
        if (!localOrderService.claimProviderQuery(order.getId())) {
            return toDto(localOrderService.getAuthorizedOrder(orderNo, userId, admin));
        }

        ProviderPaymentResult providerResult = paymentGateway.queryOrder(orderNo);
        if (providerResult.state() == PaymentProviderState.PAID) {
            order = settlementService.settlePaidOrder(orderNo, providerResult);
        } else {
            order = localOrderService.applyNonPaidProviderResult(orderNo, providerResult);
        }
        return toDto(order);
    }

    @Override
    public void handleWechatNotification(PaymentNotificationRequest request) {
        if (!"wechat".equals(paymentGateway.provider())) {
            throw new BusinessException(ResultCode.PAYMENT_NOT_ENABLED);
        }
        ProviderPaymentResult providerResult = paymentGateway.verifyNotification(request);
        handleVerifiedProviderNotification(providerResult);
    }

    @Override
    public void handleVerifiedProviderNotification(ProviderPaymentResult providerResult) {
        if (providerResult.state() == PaymentProviderState.PAID) {
            settlementService.settlePaidNotification(providerResult.orderNo(), providerResult);
        } else {
            localOrderService.applyNonPaidProviderResult(providerResult.orderNo(), providerResult);
        }
    }

    @Override
    public List<MarketplacePaymentReviewDTO> listPaymentReviews(String status) {
        LambdaQueryWrapper<ResumeViewOrder> query = paymentReviewStatusQuery(status)
                .orderByAsc(ResumeViewOrder::getPaidAt)
                .last("LIMIT 200");
        return orderMapper.selectList(query).stream().map(this::toReviewDto).toList();
    }

    @Override
    public long countPaymentReviews(String status) {
        LambdaQueryWrapper<ResumeViewOrder> query = paymentReviewStatusQuery(status);
        Long count = orderMapper.selectCount(query);
        return count == null ? 0 : count;
    }

    @Override
    public List<MarketplacePaymentReviewDTO> listOutstandingCloseWork() {
        return orderMapper.selectOutstandingCloseWork().stream().map(this::toReviewDto).toList();
    }

    private LambdaQueryWrapper<ResumeViewOrder> paymentReviewStatusQuery(String status) {
        LambdaQueryWrapper<ResumeViewOrder> query = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(status)) {
            String normalized = status.trim().toUpperCase(Locale.ROOT);
            if (!MarketplaceOrderStatus.REFUND_REQUIRED.name().equals(normalized)
                    && !MarketplaceOrderStatus.DUPLICATE_PAID.name().equals(normalized)
                    && !MarketplaceOrderStatus.REFUNDED.name().equals(normalized)) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "支付复核状态不合法");
            }
            return query.eq(ResumeViewOrder::getOrderStatus, normalized);
        }
        return query.in(
                ResumeViewOrder::getOrderStatus,
                MarketplaceOrderStatus.REFUND_REQUIRED.name(),
                MarketplaceOrderStatus.DUPLICATE_PAID.name()
        );
    }

    @Override
    public MarketplacePaymentReviewDTO getPaymentReview(String orderNo) {
        ResumeViewOrder order = orderMapper.selectByOrderNo(orderNo);
        if (order == null) {
            throw new BusinessException(ResultCode.MARKET_ORDER_NOT_FOUND);
        }
        return toReviewDto(order);
    }

    @Override
    public MarketplacePaymentReviewDTO confirmManualRefund(String orderNo, Long adminUserId,
                                                            String refundReference, String note) {
        return toReviewDto(refundReversalService.confirmManualFullRefund(
                orderNo, adminUserId, refundReference, note));
    }

    private ResumeViewOrder createProviderPrepay(ResumeViewOrder claimedOrder, String clientIp) {
        try {
            PaymentPrepayResult prepay = paymentGateway.createNativeOrder(new PaymentPrepayRequest(
                    claimedOrder.getOrderNo(),
                    PAYMENT_DESCRIPTION,
                    claimedOrder.getAmountCents(),
                    StringUtils.hasText(clientIp) ? clientIp : "127.0.0.1",
                    claimedOrder.getExpiresAt()
            ));
            if (prepay == null
                    || !Objects.equals(paymentGateway.provider(), prepay.provider())
                    || !StringUtils.hasText(prepay.codeUrl())) {
                throw new IllegalStateException("Payment provider returned an invalid Native prepay response");
            }
            // QR rendering is part of a successful prepay contract. Do it before
            // persisting PENDING so the client never receives a non-renderable order.
            qrCodeGenerator.generate(prepay.codeUrl());
            LocalDateTime expiresAt = prepay.expiresAt() == null
                    ? claimedOrder.getExpiresAt() : prepay.expiresAt();
            ResumeViewOrder stored = localOrderService.storePrepay(
                    claimedOrder.getId(), prepay.providerPrepayId(), prepay.codeUrl(), expiresAt);
            if (MarketplaceOrderStatus.PREPAY_UNKNOWN.name().equals(stored.getOrderStatus())) {
                return reconcileProviderUncertainOrder(stored, true);
            }
            return stored;
        } catch (Exception exception) {
            // A failed HTTP call or local QR render does not prove the remote
            // order was never created. Preserve the active reservation until a
            // signed provider query/close cycle establishes a terminal state.
            localOrderService.markPrepayUnknown(claimedOrder.getId());
            log.warn("Marketplace Native prepay failed orderNo={}, errorType={}",
                    claimedOrder.getOrderNo(), exception.getClass().getSimpleName());
            if (exception instanceof BusinessException businessException) {
                throw businessException;
            }
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "创建支付订单失败，请稍后重试");
        }
    }

    private ResumeViewOrder awaitConcurrentPrepay(Long orderId) {
        ResumeViewOrder order = localOrderService.getById(orderId);
        for (int i = 0; i < 10
                && order != null
                && MarketplaceOrderStatus.PREPAYING.name().equals(order.getOrderStatus()); i++) {
            try {
                Thread.sleep(50L);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                break;
            }
            order = localOrderService.getById(orderId);
        }
        if (order == null) {
            throw new BusinessException(ResultCode.MARKET_ORDER_NOT_FOUND);
        }
        return order;
    }

    private MarketplaceOrderDecision findOrCreateDecision(String listingSlug, Long buyerUserId,
                                                           boolean admin, String idempotencyKey) {
        boolean paymentEnabled = marketplaceFeatureProperties.isEnabled()
                && paymentProperties.isMarketplaceAcceptNewOrders();
        try {
            return localOrderService.findOrCreate(
                    listingSlug,
                    buyerUserId,
                    admin,
                    idempotencyKey,
                    paymentGateway.provider(),
                    payChannel(),
                    paymentEnabled
            );
        } catch (DuplicateKeyException exception) {
            return localOrderService.resolveAfterDuplicate(listingSlug, buyerUserId, idempotencyKey);
        }
    }

    private ResumeViewOrder reconcileProviderUncertainOrder(ResumeViewOrder order, boolean closePending) {
        if (!Objects.equals(order.getProvider(), paymentGateway.provider())) {
            throw new BusinessException(ResultCode.PAYMENT_NOT_ENABLED.getCode(),
                    "历史支付订单的支付渠道当前不可用，请联系管理员");
        }
        if (!localOrderService.claimProviderQuery(order.getId())) {
            ResumeViewOrder latest = localOrderService.getById(order.getId());
            return latest == null ? order : latest;
        }

        return queryProviderOrderAfterClaim(order, closePending);
    }

    private ResumeViewOrder queryProviderOrderAfterClaim(ResumeViewOrder order, boolean closePending) {
        ProviderPaymentResult first = paymentGateway.queryOrder(order.getOrderNo());
        ResumeViewOrder refreshed = applyProviderResult(order.getOrderNo(), first);
        if (!closePending || first.state() != PaymentProviderState.PENDING) {
            return refreshed;
        }

        return closeProviderOrderAndRequery(order.getOrderNo());
    }

    private ResumeViewOrder closeProviderOrderAndRequery(String orderNo) {
        RuntimeException closeFailure = null;
        try {
            paymentGateway.closeOrder(orderNo);
        } catch (RuntimeException exception) {
            closeFailure = exception;
            log.warn("Marketplace provider close needs recheck orderNo={}, errorType={}",
                    orderNo, exception.getClass().getSimpleName());
        }

        ProviderPaymentResult afterClose = paymentGateway.queryOrder(orderNo);
        ResumeViewOrder refreshed = applyProviderResult(orderNo, afterClose);
        if (afterClose.state() == PaymentProviderState.PENDING && closeFailure != null) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(),
                    "支付订单状态确认中，请稍后重试");
        }
        return refreshed;
    }

    private ResumeViewOrder applyProviderResult(String orderNo, ProviderPaymentResult result) {
        if (result.state() == PaymentProviderState.PAID) {
            return settlementService.settlePaidOrder(orderNo, result);
        }
        return localOrderService.applyNonPaidProviderResult(orderNo, result);
    }

    private boolean isPaidOrReviewStatus(ResumeViewOrder order) {
        MarketplaceOrderStatus status = MarketplaceOrderStatus.from(order.getOrderStatus());
        return status == MarketplaceOrderStatus.PAID
                || status == MarketplaceOrderStatus.DUPLICATE_PAID
                || status == MarketplaceOrderStatus.REFUND_REQUIRED;
    }

    public void closeSaleClosedOrdersBatch() {
        for (ResumeViewOrder order : localOrderService.listSaleClosedProviderOpenBatch()) {
            order = recoverStalePrepayIfNeeded(order);
            MarketplaceOrderStatus status = MarketplaceOrderStatus.from(order.getOrderStatus());
            try {
                if (status == MarketplaceOrderStatus.CREATED) {
                    localOrderService.cancelCreatedOrder(order.getId());
                } else if (status.isProviderQueryable()) {
                    reconcileProviderUncertainOrder(order, true);
                }
                // PREPAYING is deliberately left to storePrepay(), which takes
                // the listing lock after the remote call and immediately closes
                // the remote order if the sale changed in the meantime.
            } catch (RuntimeException exception) {
                log.warn("Marketplace listing-change order close deferred orderNo={}, errorType={}",
                        order.getOrderNo(), exception.getClass().getSimpleName());
            }
        }
    }

    /**
     * Reconciles ordinary in-sale orders even when the browser never refreshes
     * and the provider callback was lost. The database lease is acquired
     * before any provider I/O, so multiple application nodes cannot query or
     * close the same order concurrently.
     */
    public void reconcileOpenOrdersBatch() {
        String provider = paymentGateway.provider();
        if ("disabled".equals(provider)) {
            return;
        }
        for (Long orderId : localOrderService.listOpenReconciliationCandidateIds(provider)) {
            String leaseToken = UUID.randomUUID().toString();
            if (!localOrderService.claimOpenOrderReconciliation(orderId, provider, leaseToken)) {
                continue;
            }
            try {
                reconcileLeasedOpenOrder(orderId, leaseToken, provider);
            } catch (RuntimeException exception) {
                log.warn("Marketplace open-order reconciliation deferred orderId={}, errorType={}",
                        orderId, exception.getClass().getSimpleName());
            } finally {
                localOrderService.releaseReconciliationLease(orderId, leaseToken);
            }
        }
    }

    /**
     * Continues checking paid orders while creator income is frozen. This runs
     * even when new checkout creation is paused, and shares the durable V12
     * lease with ordinary payment reconciliation across application nodes.
     */
    public void reconcileHoldingPaidOrdersBatch() {
        String provider = paymentGateway.provider();
        if ("disabled".equals(provider)) {
            return;
        }
        LocalDateTime reconcileBefore = LocalDateTime.now().minusMinutes(
                paymentProperties.getPaidOrderReconciliationIntervalMinutes());
        LocalDateTime dueRetryBefore = LocalDateTime.now().minusMinutes(
                paymentProperties.getPaidOrderDueReconciliationRetryMinutes());
        for (Long orderId : localOrderService.listHoldingPaidReconciliationCandidateIds(
                provider, reconcileBefore, dueRetryBefore)) {
            String leaseToken = UUID.randomUUID().toString();
            if (!localOrderService.claimHoldingPaidReconciliation(
                    orderId, provider, reconcileBefore, dueRetryBefore, leaseToken)) {
                continue;
            }
            try {
                ResumeViewOrder order = localOrderService.getById(orderId);
                if (order == null
                        || !MarketplaceOrderStatus.PAID.name().equals(order.getOrderStatus())
                        || !Objects.equals(provider, order.getProvider())
                        || !Objects.equals(leaseToken, order.getReconcileLeaseToken())) {
                    continue;
                }
                ProviderPaymentResult result = paymentGateway.queryOrder(order.getOrderNo());
                // PAID refreshes provider_reconciled_at. A dedicated verified
                // REFUNDED result performs the full reversal. Generic WeChat
                // REFUND only puts settlement behind a manual amount/status
                // verification gate; every other state leaves local PAID untouched.
                applyProviderResult(order.getOrderNo(), result);
            } catch (RuntimeException exception) {
                log.warn("Marketplace paid-order refund reconciliation deferred orderId={}, errorType={}",
                        orderId, exception.getClass().getSimpleName());
            } finally {
                localOrderService.releaseReconciliationLease(orderId, leaseToken);
            }
        }
    }

    private void reconcileLeasedOpenOrder(Long orderId, String leaseToken, String provider) {
        ResumeViewOrder order = localOrderService.getById(orderId);
        if (!ownsOpenReconciliationLease(order, leaseToken, provider)) {
            return;
        }

        MarketplaceOrderStatus status = MarketplaceOrderStatus.from(order.getOrderStatus());
        if (status == MarketplaceOrderStatus.PREPAYING) {
            if (!localOrderService.recoverStalePrepay(orderId)) {
                return;
            }
            order = localOrderService.getById(orderId);
            if (!ownsOpenReconciliationLease(order, leaseToken, provider)) {
                return;
            }
            status = MarketplaceOrderStatus.from(order.getOrderStatus());
        }
        if (!status.isProviderQueryable()) {
            return;
        }

        if (status == MarketplaceOrderStatus.PENDING) {
            ResumeViewOrder refreshed = queryLeasedOpenOrder(order, orderId, leaseToken, false);
            if (!MarketplaceOrderStatus.PENDING.name().equals(refreshed.getOrderStatus())
                    || refreshed.getExpiresAt() == null
                    || refreshed.getExpiresAt().isAfter(LocalDateTime.now())) {
                return;
            }
            // Query first so a paid order is settled even if its callback was
            // lost. Only a still-unpaid order is then made locally EXPIRED and
            // closed at the provider.
            if (localOrderService.expirePendingUnderReconciliationLease(orderId, leaseToken)
                    && localOrderService.renewReconciliationLease(orderId, leaseToken)) {
                closeProviderOrderAndRequery(order.getOrderNo());
            }
            return;
        }

        // PREPAY_UNKNOWN and EXPIRED deliberately retain active_order_key.
        // Query before close to catch late payment, then close/re-query before
        // a replacement order may be created.
        queryLeasedOpenOrder(order, orderId, leaseToken, true);
    }

    private ResumeViewOrder queryLeasedOpenOrder(ResumeViewOrder order, Long orderId,
                                                  String leaseToken, boolean closePending) {
        ProviderPaymentResult first = paymentGateway.queryOrder(order.getOrderNo());
        ResumeViewOrder refreshed = applyProviderResult(order.getOrderNo(), first);
        if (!closePending || first.state() != PaymentProviderState.PENDING) {
            return refreshed;
        }
        // Never issue a destructive provider close after this node's lease has
        // expired. A later worker owns the retry once the lease can be claimed.
        if (!localOrderService.renewReconciliationLease(orderId, leaseToken)) {
            return refreshed;
        }
        return closeProviderOrderAndRequery(order.getOrderNo());
    }

    private boolean ownsOpenReconciliationLease(ResumeViewOrder order, String leaseToken, String provider) {
        return order != null
                && Objects.equals(leaseToken, order.getReconcileLeaseToken())
                && Objects.equals(provider, order.getProvider())
                && order.getSaleClosedAt() == null
                && order.getActiveOrderKey() != null;
    }

    private ResumeViewOrder recoverStalePrepayIfNeeded(ResumeViewOrder order) {
        if (MarketplaceOrderStatus.PREPAYING.name().equals(order.getOrderStatus())
                && localOrderService.recoverStalePrepay(order.getId())) {
            ResumeViewOrder recovered = localOrderService.getById(order.getId());
            return recovered == null ? order : recovered;
        }
        return order;
    }

    private ResumeViewOrder reconcileSaleClosedOrder(ResumeViewOrder order) {
        MarketplaceOrderStatus status = MarketplaceOrderStatus.from(order.getOrderStatus());
        if (status == MarketplaceOrderStatus.CREATED) {
            localOrderService.cancelCreatedOrder(order.getId());
            ResumeViewOrder cancelled = localOrderService.getById(order.getId());
            return cancelled == null ? order : cancelled;
        }
        if (status == MarketplaceOrderStatus.PREPAYING) {
            order = awaitConcurrentPrepay(order.getId());
            order = recoverStalePrepayIfNeeded(order);
            status = MarketplaceOrderStatus.from(order.getOrderStatus());
        }
        if (status.isProviderQueryable()) {
            return reconcileProviderUncertainOrder(order, true);
        }
        return order;
    }

    private MarketplaceOrderDTO toDto(ResumeViewOrder order) {
        ResumeMarketListing listing = listingMapper.selectById(order.getListingId());
        MarketplaceOrderDTO dto = new MarketplaceOrderDTO();
        dto.setOrderNo(order.getOrderNo());
        dto.setListingSlug(listing == null ? null : listing.getSlug());
        dto.setListingId(order.getListingId());
        dto.setListingRevisionId(order.getListingRevisionId());
        dto.setAmountCents(order.getAmountCents());
        dto.setCurrency(order.getCurrency());
        dto.setProvider(order.getProvider());
        dto.setPayChannel(order.getPayChannel());
        dto.setOrderStatus(order.getOrderStatus());
        boolean qrDisplayable = order.getSaleClosedAt() == null
                && MarketplaceOrderStatus.PENDING.name().equals(order.getOrderStatus())
                && order.getExpiresAt() != null
                && order.getExpiresAt().isAfter(LocalDateTime.now())
                && StringUtils.hasText(order.getCodeUrl());
        dto.setCodeUrl(qrDisplayable ? order.getCodeUrl() : null);
        dto.setQrCodeDataUrl(qrDisplayable ? qrCodeGenerator.generate(order.getCodeUrl()) : null);
        dto.setExpiresAt(format(order.getExpiresAt()));
        dto.setPaidAt(format(order.getPaidAt()));
        dto.setRefundedAt(format(order.getRefundedAt()));
        dto.setPaymentReviewReason(order.getPaymentReviewReason());
        dto.setUnlocked(listingMapper.selectActiveEntitlementRevisionId(
                order.getListingId(), order.getBuyerUserId()) != null);
        return dto;
    }

    private String payChannel() {
        return "mock".equals(paymentGateway.provider()) ? "MOCK_NATIVE" : "WECHAT_NATIVE";
    }

    private String format(LocalDateTime value) {
        return value == null ? null : TIME_FORMAT.format(value);
    }

    private MarketplacePaymentReviewDTO toReviewDto(ResumeViewOrder order) {
        ResumeMarketListing listing = listingMapper.selectById(order.getListingId());
        User buyer = userMapper.selectById(order.getBuyerUserId());
        User seller = userMapper.selectById(order.getSellerUserId());
        MarketplacePaymentReviewDTO dto = new MarketplacePaymentReviewDTO();
        dto.setId(order.getId());
        dto.setOrderNo(order.getOrderNo());
        dto.setOrderStatus(order.getOrderStatus());
        dto.setReviewReason(order.getPaymentReviewReason());
        dto.setBuyerUserId(order.getBuyerUserId());
        dto.setBuyerEmail(buyer == null ? null : buyer.getEmail());
        dto.setSellerUserId(order.getSellerUserId());
        dto.setSellerEmail(seller == null ? null : seller.getEmail());
        dto.setListingId(order.getListingId());
        dto.setListingSlug(listing == null ? null : listing.getSlug());
        dto.setListingRevisionId(order.getListingRevisionId());
        dto.setAmountCents(order.getAmountCents());
        dto.setCurrency(order.getCurrency());
        dto.setProvider(order.getProvider());
        dto.setProviderTransactionId(order.getProviderTransactionId());
        dto.setExpiresAt(format(order.getExpiresAt()));
        dto.setLastCheckedAt(format(order.getLastCheckedAt()));
        dto.setProviderReconciledAt(format(order.getProviderReconciledAt()));
        dto.setPaidAt(format(order.getPaidAt()));
        dto.setSaleClosedAt(format(order.getSaleClosedAt()));
        dto.setSaleCloseReason(order.getSaleCloseReason());
        dto.setCreatedAt(format(order.getCreatedAt()));
        dto.setRefundReference(order.getRefundReference());
        dto.setRefundNote(order.getRefundNote());
        dto.setRefundResolvedBy(order.getRefundResolvedBy());
        dto.setRefundedAt(format(order.getRefundedAt()));
        dto.setRefundResolvedAt(format(order.getRefundResolvedAt()));
        return dto;
    }
}
