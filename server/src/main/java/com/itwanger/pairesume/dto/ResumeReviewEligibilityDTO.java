package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class ResumeReviewEligibilityDTO {
    private boolean memberEligible;
    private boolean paidReviewAvailable;
    private Integer priceCents;
    private Integer maxPriorityFeeCents;
    private String notice;
}
