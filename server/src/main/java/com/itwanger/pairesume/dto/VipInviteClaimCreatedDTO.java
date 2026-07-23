package com.itwanger.pairesume.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class VipInviteClaimCreatedDTO {
    private String claimToken;
    private String status;
    private long expiresIn;
    private String expiresAt;
}
