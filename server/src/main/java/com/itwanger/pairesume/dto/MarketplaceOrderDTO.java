package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class MarketplaceOrderDTO {
    private String orderNo;
    private String listingSlug;
    private Long listingId;
    private Long listingRevisionId;
    private Integer amountCents;
    private String currency;
    private String provider;
    private String payChannel;
    private String orderStatus;
    private String codeUrl;
    private String qrCodeDataUrl;
    private String expiresAt;
    private String paidAt;
    private String refundedAt;
    private String paymentReviewReason;
    private Boolean unlocked;
}
