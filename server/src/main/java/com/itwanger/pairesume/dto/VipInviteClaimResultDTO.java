package com.itwanger.pairesume.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class VipInviteClaimResultDTO {
    private String status;
    private String message;
    private VipInviteRedemptionDTO redemption;
}
