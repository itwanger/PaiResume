package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class MembershipOrderDTO {
    private String orderNo;
    private Long userId;
    private String planCode;
    private String planName;
    private String entitlementType;
    private Integer membershipDays;
    private Integer listPriceCents;
    private Integer discountAmountCents;
    private Integer payableAmountCents;
    private String currency;
    private String provider;
    private String payChannel;
    private String orderStatus;
    private String codeUrl;
    private String qrCodeDataUrl;
    private String expiresAt;
    private String paidAt;
    private String membershipExpiresAt;
    private String paymentReviewReason;
    private String reviewStatus;
}
