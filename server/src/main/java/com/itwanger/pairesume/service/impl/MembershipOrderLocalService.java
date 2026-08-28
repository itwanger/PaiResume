package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.entity.CouponCode;
import com.itwanger.pairesume.entity.MembershipPlan;
import com.itwanger.pairesume.entity.MembershipPaymentOrder;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.CouponCodeMapper;
import com.itwanger.pairesume.mapper.MembershipPaymentOrderMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.payment.MembershipPlanCode;
import com.itwanger.pairesume.payment.MembershipOrderStatus;
import com.itwanger.pairesume.payment.MembershipPaymentReviewStatus;
import com.itwanger.pairesume.payment.MembershipPaymentVerifier;
import com.itwanger.pairesume.payment.PaymentOrderNoGenerator;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import com.itwanger.pairesume.service.MembershipPlanService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class MembershipOrderLocalService {
    private final MembershipPaymentOrderMapper orderMapper;
    private final UserMapper userMapper;
    private final CouponCodeMapper couponMapper;
    private final MembershipPlanService membershipPlanService;
    private final MarketplacePaymentProperties paymentProperties;
    private final MembershipPaymentVerifier paymentVerifier;

    @Transactional
    public MembershipPaymentOrder findOrCreate(
            Long userId,
            String idempotencyKey,
            String planCode,
            String couponCode,
            String provider,
            String payChannel
    ) {
        String normalizedPlanCode = MembershipPlanCode.fromRequest(planCode).name();
        String normalizedCoupon = normalizeCoupon(couponCode);
        User user = requireUserForUpdate(userId);
        MembershipPaymentOrder idempotent = orderMapper.selectByIdempotencyKey(userId, idempotencyKey);
        if (idempotent != null) {
            return validateExistingRequest(idempotent, normalizedPlanCode, normalizedCoupon);
        }
        if (isPermanentMember(user)) {
            throw new BusinessException(ResultCode.MEMBERSHIP_PERMANENT);
        }
        String activeKey = "MEMBERSHIP:" + userId;
        MembershipPaymentOrder active = orderMapper.selectByActiveOrderKey(activeKey);
        if (active != null) {
            return validateExistingRequest(active, normalizedPlanCode, normalizedCoupon);
        }

        MembershipPlan plan = membershipPlanService.requirePurchasable(normalizedPlanCode);
        int listPrice = plan.getPriceCents();
        if (StringUtils.hasText(normalizedCoupon)
                && !MembershipPlanCode.ANNUAL.name().equals(normalizedPlanCode)) {
            throw new BusinessException(
                    ResultCode.COUPON_INVALID.getCode(), "优惠码当前仅适用于年卡");
        }
        CouponCode coupon = null;
        int discount = 0;
        if (StringUtils.hasText(normalizedCoupon)) {
            coupon = couponMapper.selectByCodeForUpdate(normalizedCoupon);
            validateCoupon(coupon, user, LocalDateTime.now());
            discount = Math.min(listPrice, coupon.getAmountCents());
        }

        MembershipPaymentOrder order = new MembershipPaymentOrder();
        order.setOrderNo(PaymentOrderNoGenerator.generate("PM"));
        order.setUserId(userId);
        order.setIdempotencyKey(idempotencyKey);
        order.setActiveOrderKey(activeKey);
        order.setCouponCodeId(coupon == null ? null : coupon.getId());
        order.setCouponCodeSnapshot(coupon == null ? null : coupon.getCode());
        order.setPlanCode(plan.getPlanCode());
        order.setPlanNameSnapshot(plan.getDisplayName());
        order.setEntitlementType(plan.getEntitlementType());
        order.setMembershipDays(plan.getMembershipDays());
        order.setListPriceCents(listPrice);
        order.setDiscountAmountCents(discount);
        order.setPayableAmountCents(listPrice - discount);
        order.setCurrency("CNY");
        order.setProvider(order.getPayableAmountCents() == 0 ? "coupon" : provider);
        order.setPayChannel(order.getPayableAmountCents() == 0 ? "COUPON_ZERO" : payChannel);
        order.setOrderStatus(MembershipOrderStatus.CREATED.name());
        order.setReviewStatus(MembershipPaymentReviewStatus.NONE.name());
        order.setExpiresAt(LocalDateTime.now().plusMinutes(
                paymentProperties.getMembershipOrderExpireMinutes()));
        orderMapper.insert(order);
        return order;
    }

    public MembershipPaymentOrder findOrCreate(
            Long userId,
            String idempotencyKey,
            String couponCode,
            String provider,
            String payChannel
    ) {
        return findOrCreate(
                userId, idempotencyKey, MembershipPlanCode.ANNUAL.name(),
                couponCode, provider, payChannel);
    }

    public MembershipPaymentOrder resolveAfterDuplicate(
            Long userId,
            String idempotencyKey,
            String planCode,
            String couponCode
    ) {
        String normalizedPlanCode = MembershipPlanCode.fromRequest(planCode).name();
        String normalizedCoupon = normalizeCoupon(couponCode);
        MembershipPaymentOrder order = orderMapper.selectByIdempotencyKey(userId, idempotencyKey);
        if (order == null) {
            order = orderMapper.selectByActiveOrderKey("MEMBERSHIP:" + userId);
        }
        if (order == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "并发创建会员订单失败，请重试");
        }
        return validateExistingRequest(order, normalizedPlanCode, normalizedCoupon);
    }

    public MembershipPaymentOrder resolveAfterDuplicate(Long userId, String idempotencyKey) {
        return resolveAfterDuplicate(
                userId, idempotencyKey, MembershipPlanCode.ANNUAL.name(), null);
    }

    public MembershipPaymentOrder getAuthorized(String orderNo, Long userId) {
        MembershipPaymentOrder order = orderMapper.selectByOrderNo(orderNo);
        if (order == null) {
            throw new BusinessException(ResultCode.MEMBERSHIP_ORDER_NOT_FOUND);
        }
        if (!Objects.equals(order.getUserId(), userId)) {
            throw new BusinessException(ResultCode.MEMBERSHIP_ORDER_FORBIDDEN);
        }
        return order;
    }

    public MembershipPaymentOrder getActive(Long userId) {
        return orderMapper.selectByActiveOrderKey("MEMBERSHIP:" + userId);
    }

    public MembershipPaymentOrder getById(Long id) {
        return orderMapper.selectById(id);
    }

    @Transactional
    public boolean claimPrepay(Long id) {
        return orderMapper.claimPrepay(id) == 1;
    }

    @Transactional
    public MembershipPaymentOrder storePrepay(Long id, String providerPrepayId, String codeUrl,
                                               LocalDateTime expiresAt) {
        MembershipPaymentOrder order = requireOrderForUpdate(id);
        if (MembershipOrderStatus.PAID.name().equals(order.getOrderStatus())) {
            return order;
        }
        if (!MembershipOrderStatus.PREPAYING.name().equals(order.getOrderStatus())) {
            return order;
        }
        order.setProviderPrepayId(providerPrepayId);
        order.setCodeUrl(codeUrl);
        order.setExpiresAt(expiresAt);
        order.setOrderStatus(MembershipOrderStatus.PENDING.name());
        orderMapper.updateById(order);
        return order;
    }

    @Transactional
    public void markPrepayUnknown(Long id) {
        MembershipPaymentOrder order = orderMapper.selectByIdForUpdate(id);
        if (order != null && MembershipOrderStatus.PREPAYING.name().equals(order.getOrderStatus())) {
            order.setOrderStatus(MembershipOrderStatus.PREPAY_UNKNOWN.name());
            orderMapper.updateById(order);
        }
    }

    @Transactional
    public boolean recoverStalePrepay(Long id) {
        return orderMapper.recoverStalePrepay(id) == 1;
    }

    @Transactional
    public boolean claimProviderQuery(Long id) {
        return orderMapper.claimProviderQuery(id) == 1;
    }

    @Transactional
    public boolean markExpiredIfDue(Long id) {
        MembershipPaymentOrder order = requireOrderForUpdate(id);
        if (MembershipOrderStatus.PENDING.name().equals(order.getOrderStatus())
                && !order.getExpiresAt().isAfter(LocalDateTime.now())) {
            order.setOrderStatus(MembershipOrderStatus.EXPIRED.name());
            orderMapper.updateById(order);
            return true;
        }
        return MembershipOrderStatus.EXPIRED.name().equals(order.getOrderStatus());
    }

    @Transactional
    public MembershipPaymentOrder applyNonPaidResult(String orderNo, ProviderPaymentResult result) {
        MembershipPaymentOrder order = requireOrderForUpdate(orderNo);
        paymentVerifier.verify(order, result);
        if (MembershipOrderStatus.PAID.name().equals(order.getOrderStatus())) {
            if (result.state() == PaymentProviderState.REFUND_PENDING_VERIFICATION
                    || result.state() == PaymentProviderState.REFUNDED) {
                markForReview(order, result, "PAID_ORDER_PROVIDER_REFUND_REQUIRES_REVIEW");
                orderMapper.updateById(order);
            }
            // CLOSED/FAILED after a confirmed payment never revoke an already
            // granted membership. Refund states are held for manual review.
            return order;
        }
        if (MembershipOrderStatus.REFUND_REQUIRED.name().equals(order.getOrderStatus())) {
            return order;
        }
        order.setLastCheckedAt(LocalDateTime.now());
        if (result.state() == PaymentProviderState.CLOSED
                || result.state() == PaymentProviderState.FAILED) {
            order.setOrderStatus(MembershipOrderStatus.CANCELED.name());
            order.setClosedAt(LocalDateTime.now());
            order.setActiveOrderKey(null);
            order.setCodeUrl(null);
        } else if (result.state() == PaymentProviderState.REFUND_PENDING_VERIFICATION
                || result.state() == PaymentProviderState.REFUNDED) {
            markForReview(order, result, "PROVIDER_REFUND_STATE_REQUIRES_REVIEW");
        }
        orderMapper.updateById(order);
        return order;
    }

    public List<Long> listReconciliationCandidateIds(String provider) {
        return orderMapper.selectReconciliationCandidateIds(provider);
    }

    public List<Long> listExpiredCreatedCandidateIds() {
        return orderMapper.selectExpiredCreatedCandidateIds();
    }

    @Transactional
    public boolean cancelExpiredCreated(Long id) {
        return orderMapper.cancelExpiredCreated(id) == 1;
    }

    public boolean claimReconciliation(Long id, String provider, String token) {
        return orderMapper.claimReconciliation(id, provider, token) == 1;
    }

    public boolean expirePendingUnderLease(Long id, String token) {
        return orderMapper.expirePendingUnderLease(id, token) == 1;
    }

    public boolean renewLease(Long id, String token) {
        return orderMapper.renewLease(id, token) == 1;
    }

    public void releaseLease(Long id, String token) {
        orderMapper.releaseLease(id, token);
    }

    private MembershipPaymentOrder requireOrderForUpdate(Long id) {
        MembershipPaymentOrder order = orderMapper.selectByIdForUpdate(id);
        if (order == null) {
            throw new BusinessException(ResultCode.MEMBERSHIP_ORDER_NOT_FOUND);
        }
        return order;
    }

    private MembershipPaymentOrder requireOrderForUpdate(String orderNo) {
        MembershipPaymentOrder order = orderMapper.selectByOrderNoForUpdate(orderNo);
        if (order == null) {
            throw new BusinessException(ResultCode.MEMBERSHIP_ORDER_NOT_FOUND);
        }
        return order;
    }

    private User requireUserForUpdate(Long userId) {
        User user = userMapper.selectByIdForUpdate(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        return user;
    }

    private boolean isPermanentMember(User user) {
        return "ACTIVE".equals(user.getMembershipStatus()) && user.getMembershipExpiresAt() == null;
    }

    private void validateCoupon(CouponCode coupon, User user, LocalDateTime at) {
        if (coupon == null) {
            throw new BusinessException(ResultCode.COUPON_NOT_FOUND);
        }
        if ("USED".equals(coupon.getCouponStatus())) {
            throw new BusinessException(ResultCode.COUPON_ALREADY_USED);
        }
        if (!"ISSUED".equals(coupon.getCouponStatus())
                || coupon.getAmountCents() == null || coupon.getAmountCents() <= 0
                || (coupon.getExpiresAt() != null && !coupon.getExpiresAt().isAfter(at))
                || !StringUtils.hasText(coupon.getRecipientEmail())
                || !coupon.getRecipientEmail().equalsIgnoreCase(user.getEmail())) {
            throw new BusinessException(ResultCode.COUPON_INVALID);
        }
    }

    private String normalizeCoupon(String value) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : null;
    }

    private MembershipPaymentOrder validateExistingRequest(
            MembershipPaymentOrder order,
            String planCode,
            String couponCode
    ) {
        String existingPlanCode = StringUtils.hasText(order.getPlanCode())
                ? order.getPlanCode().trim().toUpperCase(Locale.ROOT)
                : legacyPlanCode(order);
        String existingCoupon = normalizeCoupon(order.getCouponCodeSnapshot());
        if (!Objects.equals(existingPlanCode, planCode)
                || !Objects.equals(existingCoupon, couponCode)) {
            throw new BusinessException(ResultCode.MEMBERSHIP_ORDER_REQUEST_CONFLICT);
        }
        return order;
    }

    private String legacyPlanCode(MembershipPaymentOrder order) {
        return Objects.equals(order.getMembershipDays(), 365)
                ? MembershipPlanCode.ANNUAL.name()
                : "LEGACY_FIXED_DAYS";
    }

    private void markForReview(MembershipPaymentOrder order, ProviderPaymentResult result, String reason) {
        order.setOrderStatus(MembershipOrderStatus.REFUND_REQUIRED.name());
        order.setProviderTransactionId(result.transactionId());
        if (result.paidAt() != null) {
            order.setPaidAt(result.paidAt());
        }
        order.setPaymentReviewReason(reason);
        order.setReviewStatus(MembershipPaymentReviewStatus.PENDING.name());
        order.setReviewUpdatedAt(LocalDateTime.now());
        order.setActiveOrderKey(null);
        order.setCodeUrl(null);
        log.error("payment_alert event=MEMBERSHIP_REFUND_REQUIRED orderNo={} reason={} source=provider_query",
                order.getOrderNo(), reason);
    }
}
