package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class MembershipPaymentAuditLogDTO {
    private Long id;
    private Long adminUserId;
    private String adminEmail;
    private String action;
    private String fromStatus;
    private String toStatus;
    private String reason;
    private String refundReference;
    private String createdAt;
}
