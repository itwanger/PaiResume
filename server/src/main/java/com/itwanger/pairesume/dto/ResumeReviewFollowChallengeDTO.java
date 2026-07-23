package com.itwanger.pairesume.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ResumeReviewFollowChallengeDTO {
    private String challengeCode;
    private String officialAccountName;
    private String qrCodeUrl;
    private String instruction;
    private String expiresAt;
}
