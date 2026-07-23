package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.dto.CouponQuoteDTO;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.payment.MarketplacePaymentGateway;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.service.CouponService;
import com.itwanger.pairesume.service.MembershipAuditService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MembershipServiceQuoteTest {
    @Mock private CouponService couponService;
    @Mock private UserMapper userMapper;
    @Mock private MembershipAuditService auditService;
    @Mock private MarketplacePaymentProperties paymentProperties;
    @Mock private MarketplacePaymentGateway paymentGateway;

    @Test
    void quoteBindsCouponValidationToCurrentUsersEmail() {
        User user = new User();
        user.setId(7L);
        user.setEmail("buyer@example.com");
        CouponQuoteDTO quoted = new CouponQuoteDTO();
        quoted.setPayableAmount(5600);
        when(userMapper.selectById(7L)).thenReturn(user);
        when(couponService.quoteForUser("PAIMINE123", "buyer@example.com")).thenReturn(quoted);
        when(paymentProperties.isMembershipAcceptNewOrders()).thenReturn(true);
        when(paymentProperties.getMembershipPaymentDays()).thenReturn(365);
        when(paymentGateway.provider()).thenReturn("wechat");
        MembershipServiceImpl service = new MembershipServiceImpl(
                couponService, userMapper, auditService, paymentProperties, paymentGateway);

        CouponQuoteDTO result = service.quote(7L, "PAIMINE123");

        assertTrue(result.isPaymentEnabled());
        assertEquals(365, result.getMembershipDays());
        verify(couponService).quoteForUser("PAIMINE123", "buyer@example.com");
    }
}
