package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class ResumeReviewAuditDTO {
    private Long id;
    private String requestNo;
    private Long actorUserId;
    private String actorType;
    private String action;
    private String fromStatus;
    private String toStatus;
    private String reason;
    private String createdAt;
}
