package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.entity.CouponCode;
import com.itwanger.pairesume.entity.PlatformConfig;
import com.itwanger.pairesume.mapper.CouponCodeMapper;
import com.itwanger.pairesume.service.MailService;
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

@ExtendWith(MockitoExtension.class)
class CouponServiceImplTest {
    @Mock private CouponCodeMapper couponCodeMapper;
    @Mock private PlatformConfigService platformConfigService;
    @Mock private MailService mailService;

    private CouponServiceImpl couponService;

    @BeforeEach
    void setUp() {
        PlatformConfig config = new PlatformConfig();
        config.setMembershipPriceCents(6600);
        when(platformConfigService.getConfigEntity()).thenReturn(config);
        couponService = new CouponServiceImpl(couponCodeMapper, platformConfigService, mailService);
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

    private CouponCode coupon(String status, String recipientEmail, int amountCents) {
        CouponCode coupon = new CouponCode();
        coupon.setCouponStatus(status);
        coupon.setRecipientEmail(recipientEmail);
        coupon.setAmountCents(amountCents);
        return coupon;
    }
}
