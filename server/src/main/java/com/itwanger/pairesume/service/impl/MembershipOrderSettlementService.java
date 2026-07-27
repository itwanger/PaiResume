package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.entity.CouponCode;
import com.itwanger.pairesume.entity.MembershipPaymentOrder;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.CouponCodeMapper;
import com.itwanger.pairesume.mapper.MembershipPaymentOrderMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.payment.MembershipOrderStatus;
import com.itwanger.pairesume.payment.MembershipEntitlementType;
import com.itwanger.pairesume.payment.MembershipPlanCode;
import com.itwanger.pairesume.payment.MembershipPaymentReviewStatus;
import com.itwanger.pairesume.payment.MembershipPaymentVerifier;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class MembershipOrderSettlementService {
    private final MembershipPaymentOrderMapper orderMapper;
    private final UserMapper userMapper;
    private final CouponCodeMapper couponMapper;
    private final MembershipPaymentVerifier paymentVerifier;

    @Transactional
    public MembershipPaymentOrder settlePaid(String orderNo, ProviderPaymentResult payment) {
        if (payment == null || payment.state() != PaymentProviderState.PAID) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }
        MembershipPaymentOrder order = requireOrder(orderNo);
        paymentVerifier.verify(order, payment);
        return settle(order, payment.transactionId(), payment.paidAt(), false);
    }

    @Transactional
    public MembershipPaymentOrder settleZeroAmount(Long orderId) {
        MembershipPaymentOrder order = orderMapper.selectByIdForUpdate(orderId);
        if (order == null) {
            throw new BusinessException(ResultCode.MEMBERSHIP_ORDER_NOT_FOUND);
        }
        if (order.getPayableAmountCents() != 0
                || !MembershipOrderStatus.CREATED.name().equals(order.getOrderStatus())
                || order.getCouponCodeId() == null) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }
        if (order.getExpiresAt() == null || !order.getExpiresAt().isAfter(LocalDateTime.now())) {
            order.setOrderStatus(MembershipOrderStatus.CANCELED.name());
            order.setActiveOrderKey(null);
            order.setClosedAt(LocalDateTime.now());
            order.setCodeUrl(null);
            orderMapper.updateById(order);
            return order;
        }
        return settle(order, "COUPON-ZERO-" + order.getOrderNo(), LocalDateTime.now(), true);
    }

    private MembershipPaymentOrder settle(MembershipPaymentOrder order, String transactionId,
                                          LocalDateTime paidAt, boolean zeroAmount) {
        if (MembershipOrderStatus.PAID.name().equals(order.getOrderStatus())) {
            if (!Objects.equals(order.getProviderTransactionId(), transactionId)) {
                throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
            }
            return order;
        }
        if (MembershipOrderStatus.REFUND_REQUIRED.name().equals(order.getOrderStatus())) {
            return order;
        }

        MembershipPaymentOrder transactionOwner = orderMapper.selectByProviderTransaction(
                order.getProvider(), transactionId);
        if (transactionOwner != null && !Objects.equals(transactionOwner.getId(), order.getId())) {
            log.error("payment_alert event=MEMBERSHIP_DUPLICATE_PROVIDER_TRANSACTION orderNo={} "
                            + "transactionOwnerOrderNo={}",
                    order.getOrderNo(), transactionOwner.getOrderNo());
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }

        User user = userMapper.selectByIdForUpdate(order.getUserId());
        if (user == null) {
            markForReview(order, transactionId, paidAt, "USER_NOT_FOUND");
            return order;
        }

        MembershipPaymentOrder replacement = orderMapper.selectPaidReplacementAfter(
                order.getUserId(), order.getId(), order.getCreatedAt());
        if (replacement != null) {
            markForReview(order, transactionId, paidAt, "LATE_PAYMENT_AFTER_REPLACEMENT_PAID");
            return order;
        }
        if (isPermanentMember(user)) {
            markForReview(order, transactionId, paidAt, "PERMANENT_MEMBERSHIP_ALREADY_ACTIVE");
            return order;
        }

        CouponCode coupon = null;
        if (order.getCouponCodeId() != null) {
            if (!MembershipPlanCode.ANNUAL.name().equals(order.getPlanCode())) {
                markForReview(order, transactionId, paidAt, "COUPON_PLAN_NOT_ELIGIBLE");
                return order;
            }
            coupon = couponMapper.selectByCodeForUpdate(order.getCouponCodeSnapshot());
            String couponProblem = couponProblem(order, coupon, user, paidAt);
            if (couponProblem != null) {
                markForReview(order, transactionId, paidAt, couponProblem);
                return order;
            }
        } else if (order.getDiscountAmountCents() != 0 || zeroAmount) {
            markForReview(order, transactionId, paidAt, "COUPON_SNAPSHOT_INVALID");
            return order;
        }

        boolean permanentEntitlement = MembershipEntitlementType.PERMANENT.name()
                .equals(order.getEntitlementType());
        boolean fixedDaysEntitlement = MembershipEntitlementType.FIXED_DAYS.name()
                .equals(order.getEntitlementType())
                || order.getEntitlementType() == null;
        if ((!permanentEntitlement && !fixedDaysEntitlement)
                || (permanentEntitlement && order.getMembershipDays() != null)
                || (fixedDaysEntitlement
                    && (order.getMembershipDays() == null || order.getMembershipDays() <= 0))) {
            markForReview(order, transactionId, paidAt, "MEMBERSHIP_PLAN_SNAPSHOT_INVALID");
            return order;
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime base = permanentEntitlement
                ? now
                : user.getMembershipExpiresAt() != null
                    && user.getMembershipExpiresAt().isAfter(now)
                    ? user.getMembershipExpiresAt() : now;
        LocalDateTime expiresAt = permanentEntitlement
                ? null : base.plusDays(order.getMembershipDays());

        order.setOrderStatus(MembershipOrderStatus.PAID.name());
        order.setProviderTransactionId(transactionId);
        order.setPaidAt(paidAt);
        order.setMembershipStartedAt(base);
        order.setMembershipExpiresAt(expiresAt);
        order.setActiveOrderKey(null);
        order.setCodeUrl(null);
        order.setPaymentReviewReason(null);
        orderMapper.updateById(order);

        if (coupon != null) {
            coupon.setCouponStatus("USED");
            coupon.setUsedByUserId(user.getId());
            coupon.setUsedAt(now);
            couponMapper.updateById(coupon);
        }

        user.setMembershipStatus("ACTIVE");
        if (user.getMembershipGrantedAt() == null) {
            user.setMembershipGrantedAt(now);
        }
        user.setMembershipSource("PAYMENT");
        user.setMembershipOriginType("PAYMENT");
        user.setMembershipOriginId(order.getId());
        user.setMembershipExpiresAt(expiresAt);
        userMapper.updateMembership(user);

        // A late, but provider-verified, payment may arrive for a locally
        // canceled order. It is honored when no later order was already paid,
        // and every still-open replacement is moved into the close workflow.
        orderMapper.cancelOtherCreatedOrders(user.getId(), order.getId());
        orderMapper.expireOtherProviderOrders(user.getId(), order.getId());
        return order;
    }

    private String couponProblem(MembershipPaymentOrder order, CouponCode coupon,
                                 User user, LocalDateTime paidAt) {
        if (coupon == null || !Objects.equals(coupon.getId(), order.getCouponCodeId())) {
            return "COUPON_NOT_FOUND_AT_SETTLEMENT";
        }
        if (!"ISSUED".equals(coupon.getCouponStatus())) {
            return "COUPON_NOT_ISSUED_AT_SETTLEMENT";
        }
        if (coupon.getAmountCents() == null
                || order.getDiscountAmountCents() != Math.min(
                        order.getListPriceCents(), coupon.getAmountCents())) {
            return "COUPON_AMOUNT_SNAPSHOT_MISMATCH";
        }
        if (coupon.getExpiresAt() != null && paidAt.isAfter(coupon.getExpiresAt())) {
            return "COUPON_EXPIRED_BEFORE_PAYMENT";
        }
        if (!StringUtils.hasText(coupon.getRecipientEmail())
                || !coupon.getRecipientEmail().equalsIgnoreCase(user.getEmail())) {
            return "COUPON_RECIPIENT_MISMATCH";
        }
        return null;
    }

    private void markForReview(MembershipPaymentOrder order, String transactionId,
                               LocalDateTime paidAt, String reason) {
        order.setOrderStatus(MembershipOrderStatus.REFUND_REQUIRED.name());
        order.setProviderTransactionId(transactionId);
        order.setPaidAt(paidAt);
        order.setActiveOrderKey(null);
        order.setCodeUrl(null);
        order.setPaymentReviewReason(reason);
        order.setReviewStatus(MembershipPaymentReviewStatus.PENDING.name());
        order.setReviewUpdatedAt(LocalDateTime.now());
        orderMapper.updateById(order);
        log.error("payment_alert event=MEMBERSHIP_REFUND_REQUIRED orderNo={} reason={} source=settlement",
                order.getOrderNo(), reason);
    }

    private MembershipPaymentOrder requireOrder(String orderNo) {
        MembershipPaymentOrder order = orderMapper.selectByOrderNoForUpdate(orderNo);
        if (order == null) {
            throw new BusinessException(ResultCode.MEMBERSHIP_ORDER_NOT_FOUND);
        }
        return order;
    }

    private boolean isPermanentMember(User user) {
        return "ACTIVE".equals(user.getMembershipStatus()) && user.getMembershipExpiresAt() == null;
    }
}
