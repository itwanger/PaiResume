package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.dto.CouponQuoteDTO;
import com.itwanger.pairesume.entity.MembershipPlan;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.payment.MarketplacePaymentGateway;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.service.CouponService;
import com.itwanger.pairesume.service.MembershipAuditService;
import com.itwanger.pairesume.service.MembershipPlanService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MembershipServiceQuoteTest {
    @Mock private CouponService couponService;
    @Mock private UserMapper userMapper;
    @Mock private MembershipAuditService auditService;
    @Mock private MembershipPlanService membershipPlanService;
    @Mock private MarketplacePaymentProperties paymentProperties;
    @Mock private MarketplacePaymentGateway paymentGateway;

    @Test
    void quoteBindsCouponValidationToCurrentUsersEmail() {
        User user = new User();
        user.setId(7L);
        user.setEmail("buyer@example.com");
        CouponQuoteDTO quoted = new CouponQuoteDTO();
        quoted.setPayableAmount(5600);
        MembershipPlan plan = new MembershipPlan();
        plan.setPlanCode("ANNUAL");
        plan.setDisplayName("年卡");
        plan.setEntitlementType("FIXED_DAYS");
        plan.setMembershipDays(365);
        plan.setPriceCents(6600);
        plan.setEnabled(true);
        plan.setRecommended(true);
        when(userMapper.selectById(7L)).thenReturn(user);
        when(membershipPlanService.requirePurchasable("ANNUAL")).thenReturn(plan);
        when(couponService.quoteForUser(
                "PAIMINE123", "buyer@example.com", 6600)).thenReturn(quoted);
        when(paymentProperties.isMembershipAcceptNewOrders()).thenReturn(true);
        when(paymentGateway.provider()).thenReturn("wechat");
        MembershipServiceImpl service = new MembershipServiceImpl(
                couponService, userMapper, null, auditService, membershipPlanService,
                paymentProperties, paymentGateway);

        CouponQuoteDTO result = service.quote(7L, "ANNUAL", "PAIMINE123");

        assertTrue(result.isPaymentEnabled());
        assertEquals("ANNUAL", result.getPlanCode());
        assertEquals("年卡", result.getPlanName());
        assertEquals("FIXED_DAYS", result.getEntitlementType());
        assertEquals(365, result.getMembershipDays());
        assertEquals(6600, result.getPriceCents());
        verify(couponService).quoteForUser(
                "PAIMINE123", "buyer@example.com", 6600);
    }

    @Test
    void couponCannotBeAppliedToNonAnnualPlan() {
        User user = new User();
        user.setId(7L);
        user.setEmail("buyer@example.com");
        MembershipPlan plan = new MembershipPlan();
        plan.setPlanCode("MONTHLY");
        plan.setDisplayName("月卡");
        plan.setEntitlementType("FIXED_DAYS");
        plan.setMembershipDays(30);
        plan.setPriceCents(3000);
        plan.setEnabled(true);
        when(userMapper.selectById(7L)).thenReturn(user);
        when(membershipPlanService.requirePurchasable("MONTHLY")).thenReturn(plan);
        MembershipServiceImpl service = new MembershipServiceImpl(
                couponService, userMapper, null, auditService, membershipPlanService,
                paymentProperties, paymentGateway);

        var exception = assertThrows(
                com.itwanger.pairesume.common.BusinessException.class,
                () -> service.quote(7L, "MONTHLY", "PAIMINE123"));

        assertEquals(
                com.itwanger.pairesume.common.ResultCode.COUPON_INVALID.getCode(),
                exception.getCode());
        verify(couponService, never()).quoteForUser(
                anyString(), anyString(), anyInt());
    }
}
