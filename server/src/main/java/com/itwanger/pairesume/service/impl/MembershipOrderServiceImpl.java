package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.MembershipOrderDTO;
import com.itwanger.pairesume.entity.MembershipPaymentOrder;
import com.itwanger.pairesume.payment.MarketplacePaymentGateway;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.payment.MembershipOrderStatus;
import com.itwanger.pairesume.payment.PaymentPrepayRequest;
import com.itwanger.pairesume.payment.PaymentPrepayResult;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import com.itwanger.pairesume.payment.QrCodeDataUrlGenerator;
import com.itwanger.pairesume.service.MembershipOrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Service
@RequiredArgsConstructor
public class MembershipOrderServiceImpl implements MembershipOrderService {
    private static final String PAYMENT_DESCRIPTION_PREFIX = "PaiResume VIP";
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final MembershipOrderLocalService localService;
    private final MembershipOrderSettlementService settlementService;
    private final MarketplacePaymentGateway paymentGateway;
    private final MarketplacePaymentProperties paymentProperties;
    private final QrCodeDataUrlGenerator qrCodeGenerator;
    private final AtomicLong reconciliationFailures = new AtomicLong();
    private final LocalDateTime observabilityStartedAt = LocalDateTime.now();
    private volatile LocalDateTime lastReconciliationFailureAt;

    @Override
    public MembershipOrderDTO createOrder(
            Long userId,
            String idempotencyKey,
            String planCode,
            String couponCode,
            String clientIp
    ) {
        if (!paymentProperties.isMembershipAcceptNewOrders()) {
            throw new BusinessException(ResultCode.PAYMENT_NOT_ENABLED);
        }
        MembershipPaymentOrder order;
        try {
            order = localService.findOrCreate(
                    userId, idempotencyKey, planCode, couponCode,
                    paymentGateway.provider(), payChannel());
        } catch (DuplicateKeyException exception) {
            order = localService.resolveAfterDuplicate(
                    userId, idempotencyKey, planCode, couponCode);
        }
        order = recoverStalePrepay(order);

        if (MembershipOrderStatus.CREATED.name().equals(order.getOrderStatus())
                && order.getExpiresAt() != null
                && !order.getExpiresAt().isAfter(LocalDateTime.now())) {
            localService.cancelExpiredCreated(order.getId());
            MembershipPaymentOrder latest = localService.getById(order.getId());
            return toDto(latest == null ? order : latest);
        }

        if (order.getPayableAmountCents() == 0
                && MembershipOrderStatus.CREATED.name().equals(order.getOrderStatus())) {
            return toDto(settlementService.settleZeroAmount(order.getId()));
        }
        if (MembershipOrderStatus.CREATED.name().equals(order.getOrderStatus())
                && localService.claimPrepay(order.getId())) {
            order = createProviderPrepay(order, clientIp);
        } else if (MembershipOrderStatus.PREPAYING.name().equals(order.getOrderStatus())) {
            order = awaitConcurrentPrepay(order.getId());
        }
        return toDto(order);
    }

    @Override
    public MembershipOrderDTO getOrder(String orderNo, Long userId) {
        return toDto(localService.getAuthorized(orderNo, userId));
    }

    @Override
    public MembershipOrderDTO getActiveOrder(Long userId) {
        MembershipPaymentOrder active = localService.getActive(userId);
        return active == null ? null : toDto(active);
    }

    @Override
    public MembershipOrderDTO refreshOrder(String orderNo, Long userId) {
        MembershipPaymentOrder order = recoverStalePrepay(localService.getAuthorized(orderNo, userId));
        MembershipOrderStatus status = MembershipOrderStatus.from(order.getOrderStatus());
        if (!status.isProviderQueryable()) {
            return toDto(order);
        }
        requireConfiguredProvider(order);
        if (!localService.claimProviderQuery(order.getId())) {
            return toDto(localService.getAuthorized(orderNo, userId));
        }
        return toDto(queryThenCloseIfNeeded(order));
    }

    @Override
    public void handleVerifiedProviderNotification(ProviderPaymentResult result) {
        if (result.state() == PaymentProviderState.PAID) {
            settlementService.settlePaid(result.orderNo(), result);
        } else {
            localService.applyNonPaidResult(result.orderNo(), result);
        }
    }

    public void reconcileOpenOrdersBatch() {
        // CREATED is a purely local state: the compare-and-set to PREPAYING did
        // not happen, so no remote order can exist. This also recovers a crash
        // between persisting a zero-amount order and its local settlement.
        for (Long orderId : localService.listExpiredCreatedCandidateIds()) {
            localService.cancelExpiredCreated(orderId);
        }
        String provider = paymentGateway.provider();
        if ("disabled".equals(provider)) {
            return;
        }
        for (Long orderId : localService.listReconciliationCandidateIds(provider)) {
            String token = UUID.randomUUID().toString();
            if (!localService.claimReconciliation(orderId, provider, token)) {
                continue;
            }
            try {
                reconcileLeasedOrder(orderId, token, provider);
            } catch (RuntimeException exception) {
                recordReconciliationFailure(orderId, exception);
            } finally {
                localService.releaseLease(orderId, token);
            }
        }
    }

    public void recordReconciliationFailure(Long orderId, RuntimeException exception) {
        reconciliationFailures.incrementAndGet();
        lastReconciliationFailureAt = LocalDateTime.now();
        log.error("payment_alert event=MEMBERSHIP_RECONCILIATION_FAILED orderId={} errorType={}",
                orderId, exception == null ? "Unknown" : exception.getClass().getSimpleName());
    }

    public ReconciliationMetrics reconciliationMetrics() {
        return new ReconciliationMetrics(
                reconciliationFailures.get(), lastReconciliationFailureAt, observabilityStartedAt);
    }

    public record ReconciliationMetrics(
            long failureCount,
            LocalDateTime lastFailureAt,
            LocalDateTime startedAt
    ) {
    }

    private MembershipPaymentOrder createProviderPrepay(MembershipPaymentOrder order, String clientIp) {
        try {
            PaymentPrepayResult prepay = paymentGateway.createNativeOrder(new PaymentPrepayRequest(
                    order.getOrderNo(), paymentDescription(order), order.getPayableAmountCents(),
                    StringUtils.hasText(clientIp) ? clientIp : "127.0.0.1", order.getExpiresAt()));
            if (prepay == null || !Objects.equals(paymentGateway.provider(), prepay.provider())
                    || !StringUtils.hasText(prepay.codeUrl())) {
                throw new IllegalStateException("Payment provider returned an invalid Native prepay response");
            }
            qrCodeGenerator.generate(prepay.codeUrl());
            LocalDateTime expiresAt = prepay.expiresAt() == null ? order.getExpiresAt() : prepay.expiresAt();
            return localService.storePrepay(
                    order.getId(), prepay.providerPrepayId(), prepay.codeUrl(), expiresAt);
        } catch (Exception exception) {
            localService.markPrepayUnknown(order.getId());
            log.warn("Membership Native prepay failed orderNo={}, errorType={}",
                    order.getOrderNo(), exception.getClass().getSimpleName());
            if (exception instanceof BusinessException businessException) {
                throw businessException;
            }
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "创建会员支付订单失败，请稍后重试");
        }
    }

    private MembershipPaymentOrder queryThenCloseIfNeeded(MembershipPaymentOrder order) {
        ProviderPaymentResult first = paymentGateway.queryOrder(order.getOrderNo());
        MembershipPaymentOrder refreshed = applyResult(order.getOrderNo(), first);
        if (first.state() != PaymentProviderState.PENDING) {
            return refreshed;
        }
        boolean unusablePrepay = MembershipOrderStatus.PREPAY_UNKNOWN.name().equals(order.getOrderStatus());
        boolean expired = refreshed.getExpiresAt() != null
                && !refreshed.getExpiresAt().isAfter(LocalDateTime.now());
        if (!unusablePrepay && !expired
                && !MembershipOrderStatus.EXPIRED.name().equals(refreshed.getOrderStatus())) {
            return refreshed;
        }
        MembershipOrderStatus refreshedStatus = MembershipOrderStatus.from(refreshed.getOrderStatus());
        if (refreshed.getActiveOrderKey() == null
                || (refreshedStatus != MembershipOrderStatus.PENDING
                    && refreshedStatus != MembershipOrderStatus.PREPAY_UNKNOWN
                    && refreshedStatus != MembershipOrderStatus.EXPIRED)) {
            return refreshed;
        }
        if (refreshedStatus == MembershipOrderStatus.PENDING
                && !localService.markExpiredIfDue(refreshed.getId())) {
            MembershipPaymentOrder latest = localService.getById(refreshed.getId());
            return latest == null ? refreshed : latest;
        }
        return closeAndRequery(refreshed.getOrderNo());
    }

    private MembershipPaymentOrder closeAndRequery(String orderNo) {
        try {
            paymentGateway.closeOrder(orderNo);
        } catch (RuntimeException exception) {
            log.warn("Membership provider close needs recheck orderNo={}, errorType={}",
                    orderNo, exception.getClass().getSimpleName());
        }
        return applyResult(orderNo, paymentGateway.queryOrder(orderNo));
    }

    private MembershipPaymentOrder applyResult(String orderNo, ProviderPaymentResult result) {
        return result.state() == PaymentProviderState.PAID
                ? settlementService.settlePaid(orderNo, result)
                : localService.applyNonPaidResult(orderNo, result);
    }

    private void reconcileLeasedOrder(Long orderId, String token, String provider) {
        MembershipPaymentOrder order = localService.getById(orderId);
        if (order == null || !Objects.equals(token, order.getReconcileLeaseToken())
                || !Objects.equals(provider, order.getProvider()) || order.getActiveOrderKey() == null) {
            return;
        }
        MembershipOrderStatus status = MembershipOrderStatus.from(order.getOrderStatus());
        if (!status.isProviderQueryable()) {
            return;
        }
        ProviderPaymentResult first = paymentGateway.queryOrder(order.getOrderNo());
        MembershipPaymentOrder refreshed = applyResult(order.getOrderNo(), first);
        if (first.state() != PaymentProviderState.PENDING) {
            return;
        }
        boolean shouldClose = status == MembershipOrderStatus.PREPAY_UNKNOWN
                || status == MembershipOrderStatus.EXPIRED
                || (refreshed.getExpiresAt() != null
                    && !refreshed.getExpiresAt().isAfter(LocalDateTime.now()));
        if (!shouldClose) {
            return;
        }
        MembershipOrderStatus refreshedStatus = MembershipOrderStatus.from(refreshed.getOrderStatus());
        if (refreshed.getActiveOrderKey() == null
                || (refreshedStatus != MembershipOrderStatus.PENDING
                    && refreshedStatus != MembershipOrderStatus.PREPAY_UNKNOWN
                    && refreshedStatus != MembershipOrderStatus.EXPIRED)) {
            return;
        }
        if (status == MembershipOrderStatus.PENDING
                && !localService.expirePendingUnderLease(orderId, token)) {
            return;
        }
        if (localService.renewLease(orderId, token)) {
            closeAndRequery(order.getOrderNo());
        }
    }

    private MembershipPaymentOrder recoverStalePrepay(MembershipPaymentOrder order) {
        if (MembershipOrderStatus.PREPAYING.name().equals(order.getOrderStatus())
                && localService.recoverStalePrepay(order.getId())) {
            MembershipPaymentOrder recovered = localService.getById(order.getId());
            return recovered == null ? order : recovered;
        }
        return order;
    }

    private MembershipPaymentOrder awaitConcurrentPrepay(Long orderId) {
        MembershipPaymentOrder order = localService.getById(orderId);
        for (int index = 0; index < 10 && order != null
                && MembershipOrderStatus.PREPAYING.name().equals(order.getOrderStatus()); index++) {
            try {
                Thread.sleep(50L);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                break;
            }
            order = localService.getById(orderId);
        }
        if (order == null) {
            throw new BusinessException(ResultCode.MEMBERSHIP_ORDER_NOT_FOUND);
        }
        return order;
    }

    private void requireConfiguredProvider(MembershipPaymentOrder order) {
        if (!Objects.equals(order.getProvider(), paymentGateway.provider())) {
            throw new BusinessException(ResultCode.PAYMENT_NOT_ENABLED.getCode(),
                    "历史会员订单的支付渠道当前不可用，请联系管理员");
        }
    }

    private MembershipOrderDTO toDto(MembershipPaymentOrder order) {
        MembershipOrderDTO dto = new MembershipOrderDTO();
        dto.setOrderNo(order.getOrderNo());
        dto.setUserId(order.getUserId());
        dto.setPlanCode(order.getPlanCode());
        dto.setPlanName(order.getPlanNameSnapshot());
        dto.setEntitlementType(order.getEntitlementType());
        dto.setMembershipDays(order.getMembershipDays());
        dto.setListPriceCents(order.getListPriceCents());
        dto.setDiscountAmountCents(order.getDiscountAmountCents());
        dto.setPayableAmountCents(order.getPayableAmountCents());
        dto.setCurrency(order.getCurrency());
        dto.setProvider(order.getProvider());
        dto.setPayChannel(order.getPayChannel());
        dto.setOrderStatus(order.getOrderStatus());
        boolean qrDisplayable = MembershipOrderStatus.PENDING.name().equals(order.getOrderStatus())
                && order.getExpiresAt() != null && order.getExpiresAt().isAfter(LocalDateTime.now())
                && StringUtils.hasText(order.getCodeUrl());
        dto.setCodeUrl(qrDisplayable ? order.getCodeUrl() : null);
        dto.setQrCodeDataUrl(qrDisplayable ? qrCodeGenerator.generate(order.getCodeUrl()) : null);
        dto.setExpiresAt(format(order.getExpiresAt()));
        dto.setPaidAt(format(order.getPaidAt()));
        dto.setMembershipExpiresAt(format(order.getMembershipExpiresAt()));
        dto.setPaymentReviewReason(order.getPaymentReviewReason());
        dto.setReviewStatus(order.getReviewStatus());
        return dto;
    }

    private String paymentDescription(MembershipPaymentOrder order) {
        return StringUtils.hasText(order.getPlanNameSnapshot())
                ? PAYMENT_DESCRIPTION_PREFIX + " " + order.getPlanNameSnapshot()
                : PAYMENT_DESCRIPTION_PREFIX + "会员";
    }

    private String payChannel() {
        return "mock".equals(paymentGateway.provider()) ? "MOCK_NATIVE" : "WECHAT_NATIVE";
    }

    private String format(LocalDateTime value) {
        return value == null ? null : TIME_FORMAT.format(value);
    }
}
