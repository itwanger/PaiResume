package com.itwanger.pairesume.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class WechatChallengeStatusDTO {
    private String challengeId;
    /** PENDING, CONFIRMED, CONSUMED, or EXPIRED. */
    private String status;
    private long expiresIn;
}
