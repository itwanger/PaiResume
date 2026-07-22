package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class MembershipAdminAuditLogDTO {
    private Long id;
    private Long adminUserId;
    private String adminEmail;
    private String action;
    private Long targetUserId;
    private String targetUserEmail;
    private Long inviteCodeId;
    private Long redemptionId;
    private String reason;
    private String beforeMembershipStatus;
    private String beforeMembershipSource;
    private String beforeMembershipExpiresAt;
    private String afterMembershipStatus;
    private String afterMembershipSource;
    private String afterMembershipExpiresAt;
    private String details;
    private String createdAt;
}
