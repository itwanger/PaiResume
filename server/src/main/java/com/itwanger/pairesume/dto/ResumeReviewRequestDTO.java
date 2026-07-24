package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class ResumeReviewRequestDTO {
    private String requestNo;
    private Long resumeId;
    private String contactEmail;
    private String contentHash;
    private String pdfFileName;
    private Long pdfSizeBytes;
    private String entitlementType;
    private String requestStatus;
    private Integer priceCents;
    private String orderNo;
    private String paymentStatus;
    private String codeUrl;
    private String qrCodeDataUrl;
    private String paymentExpiresAt;
    private String paidAt;
    private String createdAt;
    private String refundReason;
}
