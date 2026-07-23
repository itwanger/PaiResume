package com.itwanger.pairesume.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class WechatChallengeCreateDTO {
    private String challengeId;
    private String pollToken;
    private String qrImageDataUrl;
    private long expiresIn;
}
