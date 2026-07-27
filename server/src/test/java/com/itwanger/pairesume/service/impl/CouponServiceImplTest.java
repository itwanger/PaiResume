package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.entity.CouponCode;
import com.itwanger.pairesume.entity.MembershipPlan;
import com.itwanger.pairesume.entity.PlatformConfig;
import com.itwanger.pairesume.mapper.CouponCodeMapper;
import com.itwanger.pairesume.service.MailService;
import com.itwanger.pairesume.service.MembershipPlanService;
import com.itwanger.pairesume.service.PlatformConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class CouponServiceImplTest {
    @Mock private CouponCodeMapper couponCodeMapper;
    @Mock private PlatformConfigService platformConfigService;
    @Mock private MailService mailService;
    @Mock private MembershipPlanService membershipPlanService;

    private CouponServiceImpl couponService;

    @BeforeEach
    void setUp() {
        PlatformConfig config = new PlatformConfig();
        config.setMembershipPriceCents(6600);
        lenient().when(platformConfigService.getConfigEntity()).thenReturn(config);
        MembershipPlan annual = new MembershipPlan();
        annual.setPlanCode("ANNUAL");
        annual.setPriceCents(6600);
        lenient().when(membershipPlanService.requirePurchasable("ANNUAL"))
                .thenReturn(annual);
        couponService = new CouponServiceImpl(
                couponCodeMapper, platformConfigService, mailService, membershipPlanService);
    }

    @Test
    void quoteForUserChecksOwnershipBeforeRevealingUsedState() {
        CouponCode coupon = coupon("USED", "owner@example.com", 1000);
        when(couponCodeMapper.selectOne(any())).thenReturn(coupon);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> couponService.quoteForUser("PAIOWNER123", "other@example.com"));

        assertEquals(7002, exception.getCode());
    }

    @Test
    void quoteForUserAppliesOwnedCoupon() {
        CouponCode coupon = coupon("ISSUED", "buyer@example.com", 1600);
        when(couponCodeMapper.selectOne(any())).thenReturn(coupon);

        var quote = couponService.quoteForUser("PAIMINE123", " Buyer@Example.com ");

        assertEquals(6600, quote.getListPrice());
        assertEquals(1600, quote.getDiscountAmount());
        assertEquals(5000, quote.getPayableAmount());
        assertEquals("VALID", quote.getCouponStatus());
    }

    @Test
    void quoteUsesServerSelectedPlanPriceInsteadOfLegacyAnnualPrice() {
        CouponCode coupon = coupon("ISSUED", "buyer@example.com", 1600);
        when(couponCodeMapper.selectOne(any())).thenReturn(coupon);

        var quote = couponService.quoteForUser(
                "PAIMINE123", "buyer@example.com", 3000);

        assertEquals(3000, quote.getListPrice());
        assertEquals(1600, quote.getDiscountAmount());
        assertEquals(1400, quote.getPayableAmount());
    }

    private CouponCode coupon(String status, String recipientEmail, int amountCents) {
        CouponCode coupon = new CouponCode();
        coupon.setCouponStatus(status);
        coupon.setRecipientEmail(recipientEmail);
        coupon.setAmountCents(amountCents);
        return coupon;
    }
}
