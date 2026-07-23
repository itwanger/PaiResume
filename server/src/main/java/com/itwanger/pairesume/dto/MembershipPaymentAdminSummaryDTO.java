package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class MembershipPaymentAdminSummaryDTO {
    private long totalOrders;
    private long refundRequiredOrders;
    private long pendingReviews;
    private long refundProcessingReviews;
    private long refundedReviews;
    private long rejectedReviews;
    private long closedReviews;
    private long duplicatePaymentReviews;
    private long reconciliationFailuresSinceStart;
    private String lastReconciliationFailureAt;
    private String observabilityStartedAt;
}
