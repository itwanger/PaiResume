package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class CouponAdminDTO {
    private Long id;
    private String code;
    private String recipientEmail;
    private Integer amountCents;
    private String status;
    private String emailSentAt;
    private String usedAt;
    private String expiresAt;
}
