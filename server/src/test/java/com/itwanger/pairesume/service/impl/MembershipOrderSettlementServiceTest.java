package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.entity.CouponCode;
import com.itwanger.pairesume.entity.MembershipPaymentOrder;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.CouponCodeMapper;
import com.itwanger.pairesume.mapper.MembershipPaymentOrderMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.payment.MembershipOrderStatus;
import com.itwanger.pairesume.payment.MembershipPaymentReviewStatus;
import com.itwanger.pairesume.payment.MembershipPaymentVerifier;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MembershipOrderSettlementServiceTest {
    @Mock private MembershipPaymentOrderMapper orderMapper;
    @Mock private UserMapper userMapper;
    @Mock private CouponCodeMapper couponMapper;
    @Mock private MembershipPaymentVerifier paymentVerifier;

    private MembershipOrderSettlementService service;

    @BeforeEach
    void setUp() {
        service = new MembershipOrderSettlementService(
                orderMapper, userMapper, couponMapper, paymentVerifier);
    }

    @Test
    void paidRenewalExtendsFromCurrentFutureExpiration() {
        MembershipPaymentOrder order = order(MembershipOrderStatus.PENDING);
        User user = user("ACTIVE");
        LocalDateTime oldExpiration = LocalDateTime.now().plusDays(8);
        user.setMembershipExpiresAt(oldExpiration);
        ProviderPaymentResult paid = paid(order);
        when(orderMapper.selectByOrderNoForUpdate(order.getOrderNo())).thenReturn(order);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);

        MembershipPaymentOrder settled = service.settlePaid(order.getOrderNo(), paid);

        assertEquals(MembershipOrderStatus.PAID.name(), settled.getOrderStatus());
        assertEquals(oldExpiration.plusDays(30), settled.getMembershipExpiresAt());
        assertEquals(oldExpiration.plusDays(30), user.getMembershipExpiresAt());
        assertEquals("PAYMENT", user.getMembershipOriginType());
        verify(userMapper).updateMembership(user);
        verify(orderMapper).cancelOtherCreatedOrders(7L, order.getId());
        verify(orderMapper).expireOtherProviderOrders(7L, order.getId());
    }

    @Test
    void pendingProviderResultCanNeverActivateMembership() {
        MembershipPaymentOrder order = order(MembershipOrderStatus.PENDING);
        ProviderPaymentResult pending = new ProviderPaymentResult(
                PaymentProviderState.PENDING, order.getOrderNo(), null,
                "app", "merchant", "CNY", order.getPayableAmountCents(), null);

        assertThrows(com.itwanger.pairesume.common.BusinessException.class,
                () -> service.settlePaid(order.getOrderNo(), pending));

        verify(userMapper, never()).updateMembership(org.mockito.ArgumentMatchers.any());
        verify(orderMapper, never()).selectByOrderNoForUpdate(order.getOrderNo());
    }

    @Test
    void paidNotificationReplayDoesNotExtendMembershipOrConsumeCouponAgain() {
        MembershipPaymentOrder alreadyPaid = order(MembershipOrderStatus.PAID);
        alreadyPaid.setProviderTransactionId("wx-tx-1");
        LocalDateTime grantedExpiration = LocalDateTime.now().plusDays(30);
        alreadyPaid.setMembershipExpiresAt(grantedExpiration);
        ProviderPaymentResult replay = paid(alreadyPaid);
        when(orderMapper.selectByOrderNoForUpdate(alreadyPaid.getOrderNo())).thenReturn(alreadyPaid);

        MembershipPaymentOrder result = service.settlePaid(alreadyPaid.getOrderNo(), replay);

        assertEquals(grantedExpiration, result.getMembershipExpiresAt());
        verify(userMapper, never()).selectByIdForUpdate(org.mockito.ArgumentMatchers.any());
        verify(userMapper, never()).updateMembership(org.mockito.ArgumentMatchers.any());
        verify(couponMapper, never()).updateById(
                org.mockito.ArgumentMatchers.any(CouponCode.class));
    }

    @Test
    void permanentMembershipMovesUnexpectedPaymentToRefundReview() {
        MembershipPaymentOrder order = order(MembershipOrderStatus.CANCELED);
        User user = user("ACTIVE");
        user.setMembershipExpiresAt(null);
        ProviderPaymentResult paid = paid(order);
        when(orderMapper.selectByOrderNoForUpdate(order.getOrderNo())).thenReturn(order);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);

        MembershipPaymentOrder settled = service.settlePaid(order.getOrderNo(), paid);

        assertEquals(MembershipOrderStatus.REFUND_REQUIRED.name(), settled.getOrderStatus());
        assertEquals(MembershipPaymentReviewStatus.PENDING.name(), settled.getReviewStatus());
        assertEquals("PERMANENT_MEMBERSHIP_ALREADY_ACTIVE", settled.getPaymentReviewReason());
        verify(userMapper, never()).updateMembership(user);
    }

    @Test
    void zeroAmountOrderConsumesLockedRecipientCouponAndActivatesMembership() {
        MembershipPaymentOrder order = order(MembershipOrderStatus.CREATED);
        order.setProvider("coupon");
        order.setPayableAmountCents(0);
        order.setDiscountAmountCents(6600);
        order.setCouponCodeId(88L);
        order.setCouponCodeSnapshot("PAITEST123");
        order.setExpiresAt(LocalDateTime.now().plusMinutes(30));
        User user = user("FREE");
        CouponCode coupon = new CouponCode();
        coupon.setId(88L);
        coupon.setCode("PAITEST123");
        coupon.setCouponStatus("ISSUED");
        coupon.setAmountCents(6600);
        coupon.setRecipientEmail(user.getEmail());
        when(orderMapper.selectByIdForUpdate(order.getId())).thenReturn(order);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(couponMapper.selectByCodeForUpdate("PAITEST123")).thenReturn(coupon);

        MembershipPaymentOrder settled = service.settleZeroAmount(order.getId());

        assertEquals(MembershipOrderStatus.PAID.name(), settled.getOrderStatus());
        assertEquals("USED", coupon.getCouponStatus());
        assertEquals(7L, coupon.getUsedByUserId());
        assertEquals("ACTIVE", user.getMembershipStatus());
        verify(couponMapper).updateById(coupon);
        verify(userMapper).updateMembership(user);
    }

    @Test
    void expiredZeroAmountOrderIsCanceledWithoutConsumingCouponOrGrantingVip() {
        MembershipPaymentOrder order = order(MembershipOrderStatus.CREATED);
        order.setProvider("coupon");
        order.setPayableAmountCents(0);
        order.setDiscountAmountCents(6600);
        order.setCouponCodeId(88L);
        order.setCouponCodeSnapshot("PAITEST123");
        order.setExpiresAt(LocalDateTime.now().minusSeconds(1));
        when(orderMapper.selectByIdForUpdate(order.getId())).thenReturn(order);

        MembershipPaymentOrder result = service.settleZeroAmount(order.getId());

        assertEquals(MembershipOrderStatus.CANCELED.name(), result.getOrderStatus());
        verify(couponMapper, never()).selectByCodeForUpdate(org.mockito.ArgumentMatchers.anyString());
        verify(userMapper, never()).updateMembership(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void lateCanceledPaymentAfterNewPaidOrderRequiresRefund() {
        MembershipPaymentOrder oldOrder = order(MembershipOrderStatus.CANCELED);
        MembershipPaymentOrder replacement = order(MembershipOrderStatus.PAID);
        replacement.setId(9L);
        ProviderPaymentResult paid = paid(oldOrder);
        when(orderMapper.selectByOrderNoForUpdate(oldOrder.getOrderNo())).thenReturn(oldOrder);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user("ACTIVE"));
        when(orderMapper.selectPaidReplacementAfter(
                oldOrder.getUserId(), oldOrder.getId(), oldOrder.getCreatedAt()))
                .thenReturn(replacement);

        MembershipPaymentOrder settled = service.settlePaid(oldOrder.getOrderNo(), paid);

        assertEquals(MembershipOrderStatus.REFUND_REQUIRED.name(), settled.getOrderStatus());
        assertEquals(MembershipPaymentReviewStatus.PENDING.name(), settled.getReviewStatus());
        assertEquals("LATE_PAYMENT_AFTER_REPLACEMENT_PAID", settled.getPaymentReviewReason());
        verify(userMapper, never()).updateMembership(org.mockito.ArgumentMatchers.any());
    }

    private MembershipPaymentOrder order(MembershipOrderStatus status) {
        MembershipPaymentOrder order = new MembershipPaymentOrder();
        order.setId(5L);
        order.setOrderNo("PM-test-order");
        order.setUserId(7L);
        order.setActiveOrderKey("MEMBERSHIP:7");
        order.setMembershipDays(30);
        order.setListPriceCents(6600);
        order.setDiscountAmountCents(0);
        order.setPayableAmountCents(6600);
        order.setCurrency("CNY");
        order.setProvider("wechat");
        order.setOrderStatus(status.name());
        order.setCreatedAt(LocalDateTime.now().minusMinutes(31));
        order.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        return order;
    }

    private User user(String membershipStatus) {
        User user = new User();
        user.setId(7L);
        user.setEmail("buyer@example.com");
        user.setMembershipStatus(membershipStatus);
        return user;
    }

    private ProviderPaymentResult paid(MembershipPaymentOrder order) {
        return new ProviderPaymentResult(
                PaymentProviderState.PAID, order.getOrderNo(), "wx-tx-1",
                "app", "merchant", "CNY", order.getPayableAmountCents(), LocalDateTime.now());
    }
}
