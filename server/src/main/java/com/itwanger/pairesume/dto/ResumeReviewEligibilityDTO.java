package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class ResumeReviewEligibilityDTO {
    private boolean welcomeFreeAvailable;
    private boolean followRewardIssued;
    private boolean followRewardAvailable;
    private boolean paidReviewAvailable;
    private String nextEntitlement;
    private Integer priceCents;
    private String followOfficialAccountName;
    private String followQrCodeUrl;
    private String notice;
}
