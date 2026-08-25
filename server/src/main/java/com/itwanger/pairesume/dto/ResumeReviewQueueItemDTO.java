package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class ResumeReviewQueueItemDTO {
    private int position;
    private String publicCode;
    private String queueStatus;
    private boolean priority;
    private Integer priorityFeeCents;
    private Integer paidAmountCents;
    private String queuedAt;
}
