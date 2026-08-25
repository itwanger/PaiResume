package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class ResumeReviewAdminRequestDTO {
    private String requestNo;
    private Long userId;
    private Long resumeId;
    private String contactEmail;
    private String contentHash;
    private String pdfFileName;
    private Long pdfSizeBytes;
    private String entitlementType;
    private String requestStatus;
    private Integer priceCents;
    private Integer basePriceCents;
    private Integer priorityFeeCents;
    private String orderNo;
    private String provider;
    private String payChannel;
    private String paymentStatus;
    private String providerTransactionId;
    private String paymentExpiresAt;
    private String paidAt;
    private String queuedAt;
    private String refundReason;
    private String refundReference;
    private Long handledBy;
    private String acceptedAt;
    private String completedAt;
    private String returnedAt;
    private String createdAt;
    private String mailStatus;
    private Integer mailAttemptCount;
    private String mailLastErrorType;
    private String mailNextAttemptAt;
    private String mailSentAt;
}
