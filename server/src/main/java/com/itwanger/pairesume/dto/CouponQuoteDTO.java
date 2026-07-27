package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class CouponQuoteDTO {
    private String planCode;
    private String planName;
    private String entitlementType;
    private Integer membershipDays;
    private Integer priceCents;
    private boolean enabled;
    private boolean recommended;
    private Integer listPrice;
    private Integer discountAmount;
    private Integer payableAmount;
    private String couponStatus;
    private boolean paymentEnabled;
}
