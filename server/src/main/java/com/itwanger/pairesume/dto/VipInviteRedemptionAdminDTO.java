package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class VipInviteRedemptionAdminDTO {
    private Long id;
    private Long inviteCodeId;
    private Long userId;
    private String userEmail;
    private String membershipStartedAt;
    private String membershipExpiresAt;
    private String redemptionStatus;
    private Long revokedBy;
    private String revokedAt;
    private String revokeReason;
    private String redeemedAt;
}
