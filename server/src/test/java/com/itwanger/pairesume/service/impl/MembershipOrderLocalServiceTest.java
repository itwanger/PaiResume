package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.entity.MembershipPaymentOrder;
import com.itwanger.pairesume.entity.CouponCode;
import com.itwanger.pairesume.entity.PlatformConfig;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MembershipOrderLocalServiceTest {
    @Mock private MembershipPaymentOrderMapper orderMapper;
    @Mock private UserMapper userMapper;
    @Mock private CouponCodeMapper couponMapper;
    @Mock private PlatformConfigService platformConfigService;
    @Mock private MarketplacePaymentProperties paymentProperties;
    @Mock private MembershipPaymentVerifier paymentVerifier;
    private MembershipOrderLocalService service;

    @BeforeEach
    void setUp() {
        service = new MembershipOrderLocalService(orderMapper, userMapper, couponMapper,
                platformConfigService, paymentProperties, paymentVerifier);
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
        PlatformConfig config = new PlatformConfig();
        config.setMembershipPriceCents(6600);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(platformConfigService.getConfigEntity()).thenReturn(config);
        when(paymentProperties.getMembershipPaymentDays()).thenReturn(365);
        when(paymentProperties.getMembershipOrderExpireMinutes()).thenReturn(30);
        when(orderMapper.insert(any(MembershipPaymentOrder.class))).thenAnswer(invocation -> {
            invocation.<MembershipPaymentOrder>getArgument(0).setId(99L);
            return 1;
        });
        LocalDateTime before = LocalDateTime.now();

        MembershipPaymentOrder order = service.findOrCreate(
                7L, "member-key-123", null, "wechat", "WECHAT_NATIVE");

        assertEquals(6600, order.getListPriceCents());
        assertEquals(6600, order.getPayableAmountCents());
        assertEquals(365, order.getMembershipDays());
        assertEquals(MembershipPaymentReviewStatus.NONE.name(), order.getReviewStatus());
        assertTrue(!order.getExpiresAt().isBefore(before.plusMinutes(30))
                && !order.getExpiresAt().isAfter(LocalDateTime.now().plusMinutes(30)));
    }

    @Test
    void couponBelongingToAnotherEmailIsRejectedAtOrderCreation() {
        User user = freeUser();
        PlatformConfig config = new PlatformConfig();
        config.setMembershipPriceCents(6600);
        CouponCode coupon = new CouponCode();
        coupon.setCode("PAIOTHER123");
        coupon.setCouponStatus("ISSUED");
        coupon.setAmountCents(1000);
        coupon.setRecipientEmail("other@example.com");
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(platformConfigService.getConfigEntity()).thenReturn(config);
        when(couponMapper.selectByCodeForUpdate("PAIOTHER123")).thenReturn(coupon);

        assertThrows(com.itwanger.pairesume.common.BusinessException.class,
                () -> service.findOrCreate(
                        7L, "member-key-123", "paiother123", "wechat", "WECHAT_NATIVE"));
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
}
