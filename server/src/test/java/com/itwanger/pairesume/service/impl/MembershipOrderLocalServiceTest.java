package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.entity.MembershipPaymentOrder;
import com.itwanger.pairesume.entity.CouponCode;
import com.itwanger.pairesume.entity.MembershipPlan;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.CouponCodeMapper;
import com.itwanger.pairesume.mapper.MembershipPaymentOrderMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.payment.MembershipOrderStatus;
import com.itwanger.pairesume.payment.MembershipPaymentReviewStatus;
import com.itwanger.pairesume.payment.MembershipPaymentVerifier;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import com.itwanger.pairesume.service.PlatformConfigService;
import com.itwanger.pairesume.service.MembershipPlanService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MembershipOrderLocalServiceTest {
    @Mock private MembershipPaymentOrderMapper orderMapper;
    @Mock private UserMapper userMapper;
    @Mock private CouponCodeMapper couponMapper;
    @Mock private MembershipPlanService membershipPlanService;
    @Mock private MarketplacePaymentProperties paymentProperties;
    @Mock private MembershipPaymentVerifier paymentVerifier;
    private MembershipOrderLocalService service;

    @BeforeEach
    void setUp() {
        service = new MembershipOrderLocalService(orderMapper, userMapper, couponMapper,
                membershipPlanService, paymentProperties, paymentVerifier);
    }

    @Test
    void providerRefundStateMovesPaidOrderToReviewWithoutRevokingMembership() {
        MembershipPaymentOrder paid = new MembershipPaymentOrder();
        paid.setId(1L);
        paid.setOrderNo("PM123");
        paid.setOrderStatus(MembershipOrderStatus.PAID.name());
        paid.setProviderTransactionId("wx-tx");
        LocalDateTime originalPaidAt = LocalDateTime.now().minusDays(2);
        paid.setPaidAt(originalPaidAt);
        ProviderPaymentResult refund = new ProviderPaymentResult(
                PaymentProviderState.REFUND_PENDING_VERIFICATION, "PM123", "wx-tx",
                "app", "merchant", "CNY", 6600, null);
        when(orderMapper.selectByOrderNoForUpdate("PM123")).thenReturn(paid);

        MembershipPaymentOrder result = service.applyNonPaidResult("PM123", refund);

        assertEquals(MembershipOrderStatus.REFUND_REQUIRED.name(), result.getOrderStatus());
        assertEquals(MembershipPaymentReviewStatus.PENDING.name(), result.getReviewStatus());
        assertEquals("PAID_ORDER_PROVIDER_REFUND_REQUIRES_REVIEW", result.getPaymentReviewReason());
        assertEquals(originalPaidAt, result.getPaidAt());
        verify(paymentVerifier).verify(paid, refund);
        verify(orderMapper).updateById(paid);
    }

    @Test
    void createdOrderSnapshotsAnnualMembershipAndThirtyMinuteDeadline() {
        User user = freeUser();
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(membershipPlanService.requirePurchasable("ANNUAL"))
                .thenReturn(plan("ANNUAL", "年卡", "FIXED_DAYS", 365, 6600));
        when(paymentProperties.getMembershipOrderExpireMinutes()).thenReturn(30);
        when(orderMapper.insert(any(MembershipPaymentOrder.class))).thenAnswer(invocation -> {
            invocation.<MembershipPaymentOrder>getArgument(0).setId(99L);
            return 1;
        });
        LocalDateTime before = LocalDateTime.now();

        MembershipPaymentOrder order = service.findOrCreate(
                7L, "member-key-123", "ANNUAL", null,
                "wechat", "WECHAT_NATIVE");

        assertEquals("ANNUAL", order.getPlanCode());
        assertEquals("年卡", order.getPlanNameSnapshot());
        assertEquals("FIXED_DAYS", order.getEntitlementType());
        assertEquals(6600, order.getListPriceCents());
        assertEquals(6600, order.getPayableAmountCents());
        assertEquals(365, order.getMembershipDays());
        assertTrue(order.getOrderNo().startsWith("PM"));
        assertEquals(32, order.getOrderNo().length());
        assertEquals(MembershipPaymentReviewStatus.NONE.name(), order.getReviewStatus());
        assertTrue(!order.getExpiresAt().isBefore(before.plusMinutes(30))
                && !order.getExpiresAt().isAfter(LocalDateTime.now().plusMinutes(30)));
    }

    @Test
    void couponBelongingToAnotherEmailIsRejectedAtOrderCreation() {
        User user = freeUser();
        CouponCode coupon = new CouponCode();
        coupon.setCode("PAIOTHER123");
        coupon.setCouponStatus("ISSUED");
        coupon.setAmountCents(1000);
        coupon.setRecipientEmail("other@example.com");
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(membershipPlanService.requirePurchasable("ANNUAL"))
                .thenReturn(plan("ANNUAL", "年卡", "FIXED_DAYS", 365, 6600));
        when(couponMapper.selectByCodeForUpdate("PAIOTHER123")).thenReturn(coupon);

        assertThrows(com.itwanger.pairesume.common.BusinessException.class,
                () -> service.findOrCreate(
                        7L, "member-key-123", "ANNUAL", "paiother123",
                        "wechat", "WECHAT_NATIVE"));
    }

    @Test
    void lifetimeOrderSnapshotsPermanentEntitlementWithoutFakeDays() {
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(freeUser());
        when(membershipPlanService.requirePurchasable("LIFETIME"))
                .thenReturn(plan("LIFETIME", "终身会员", "PERMANENT", null, 19900));
        when(paymentProperties.getMembershipOrderExpireMinutes()).thenReturn(30);

        MembershipPaymentOrder order = service.findOrCreate(
                7L, "lifetime-key-123", "LIFETIME", null,
                "wechat", "WECHAT_NATIVE");

        assertEquals("LIFETIME", order.getPlanCode());
        assertEquals("终身会员", order.getPlanNameSnapshot());
        assertEquals("PERMANENT", order.getEntitlementType());
        assertNull(order.getMembershipDays());
        assertEquals(19900, order.getListPriceCents());
    }

    @Test
    void sameIdempotencyKeyCannotBeReusedForAnotherPlan() {
        MembershipPaymentOrder existing = new MembershipPaymentOrder();
        existing.setPlanCode("ANNUAL");
        existing.setCouponCodeSnapshot(null);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(freeUser());
        when(orderMapper.selectByIdempotencyKey(7L, "same-key-123"))
                .thenReturn(existing);

        var exception = assertThrows(
                com.itwanger.pairesume.common.BusinessException.class,
                () -> service.findOrCreate(
                        7L, "same-key-123", "MONTHLY", null,
                        "wechat", "WECHAT_NATIVE"));

        assertEquals(
                com.itwanger.pairesume.common.ResultCode.MEMBERSHIP_ORDER_REQUEST_CONFLICT.getCode(),
                exception.getCode());
    }

    @Test
    void activeOrderForAnotherPlanCannotBeSilentlyReused() {
        MembershipPaymentOrder active = new MembershipPaymentOrder();
        active.setPlanCode("QUARTERLY");
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(freeUser());
        when(orderMapper.selectByActiveOrderKey("MEMBERSHIP:7")).thenReturn(active);

        var exception = assertThrows(
                com.itwanger.pairesume.common.BusinessException.class,
                () -> service.findOrCreate(
                        7L, "new-key-123", "ANNUAL", null,
                        "wechat", "WECHAT_NATIVE"));

        assertEquals(
                com.itwanger.pairesume.common.ResultCode.MEMBERSHIP_ORDER_REQUEST_CONFLICT.getCode(),
                exception.getCode());
    }

    @Test
    void anotherUserCannotReadMembershipOrder() {
        MembershipPaymentOrder order = new MembershipPaymentOrder();
        order.setOrderNo("PM-private");
        order.setUserId(7L);
        when(orderMapper.selectByOrderNo("PM-private")).thenReturn(order);

        com.itwanger.pairesume.common.BusinessException exception = assertThrows(
                com.itwanger.pairesume.common.BusinessException.class,
                () -> service.getAuthorized("PM-private", 8L));

        assertEquals(com.itwanger.pairesume.common.ResultCode.MEMBERSHIP_ORDER_FORBIDDEN.getCode(),
                exception.getCode());
    }

    private User freeUser() {
        User user = new User();
        user.setId(7L);
        user.setEmail("buyer@example.com");
        user.setMembershipStatus("FREE");
        return user;
    }

    private MembershipPlan plan(
            String code,
            String name,
            String entitlementType,
            Integer days,
            int priceCents
    ) {
        MembershipPlan plan = new MembershipPlan();
        plan.setPlanCode(code);
        plan.setDisplayName(name);
        plan.setEntitlementType(entitlementType);
        plan.setMembershipDays(days);
        plan.setPriceCents(priceCents);
        plan.setEnabled(true);
        return plan;
    }
}
