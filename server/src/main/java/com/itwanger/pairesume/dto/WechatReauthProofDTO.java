package com.itwanger.pairesume.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class WechatReauthProofDTO {
    private String reauthProof;
    private long expiresIn;
}
