package com.itwanger.pairesume.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class VipInviteRedemptionDTO {
    private String membershipStatus;
    private String membershipGrantedAt;
    private String membershipExpiresAt;
    private String membershipSource;
}
