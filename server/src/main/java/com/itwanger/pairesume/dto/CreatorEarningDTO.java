package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class CreatorEarningDTO {
    private Long id;
    private Long sellerUserId;
    private String sellerEmail;
    private Long listingId;
    private String listingSlug;
    private String orderNo;
    private String sourceOrderStatus;
    private Integer grossAmountCents;
    private Integer platformFeeCents;
    private Integer netAmountCents;
    private Integer walletCreditCents;
    private Integer debtOffsetCents;
    private String earningStatus;
    private String availableAt;
    private String reversedAt;
    private String reversedFromStatus;
    private String reversalReason;
    private String settledAt;
    private String settlementNote;
    private String createdAt;
}
