package com.itwanger.pairesume.dto;

import lombok.Data;

import java.util.List;

@Data
public class MembershipPaymentAdminOrderDTO {
    private Long id;
    private String orderNo;
    private Long userId;
    private String userEmail;
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
    private String providerTransactionId;
    private String paymentReviewReason;
    private String reviewStatus;
    private String lastAdminAction;
    private String adminActionReason;
    private Long handledBy;
    private String handlerEmail;
    private String refundReference;
    private String expiresAt;
    private String paidAt;
    private String closedAt;
    private String membershipStartedAt;
    private String membershipExpiresAt;
    private String reviewStartedAt;
    private String reviewResolvedAt;
    private String reviewUpdatedAt;
    private String createdAt;
    private String updatedAt;
    private List<MembershipPaymentAuditLogDTO> auditLogs;
}
