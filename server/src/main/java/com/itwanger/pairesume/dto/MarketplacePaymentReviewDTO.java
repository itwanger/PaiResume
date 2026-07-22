package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class MarketplacePaymentReviewDTO {
    private Long id;
    private String orderNo;
    private String orderStatus;
    private String reviewReason;
    private Long buyerUserId;
    private String buyerEmail;
    private Long sellerUserId;
    private String sellerEmail;
    private Long listingId;
    private String listingSlug;
    private Long listingRevisionId;
    private Integer amountCents;
    private String currency;
    private String provider;
    private String providerTransactionId;
    private String expiresAt;
    private String lastCheckedAt;
    private String providerReconciledAt;
    private String paidAt;
    private String saleClosedAt;
    private String saleCloseReason;
    private String createdAt;
    private String refundReference;
    private String refundNote;
    private Long refundResolvedBy;
    private String refundedAt;
    private String refundResolvedAt;
}
