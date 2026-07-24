package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class ResumeReviewEligibilityDTO {
    private boolean enabled;
    private boolean welcomeFreeAvailable;
    private boolean paidReviewAvailable;
    private String nextEntitlement;
    private Integer priceCents;
    private String notice;
}
