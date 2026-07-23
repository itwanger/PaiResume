package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class MarketplaceGovernanceAuditDTO {
    private Long id;
    private Long listingId;
    private Long actorUserId;
    private String actorType;
    private String action;
    private String targetType;
    private Long targetId;
    private String fromStatus;
    private String toStatus;
    private String reason;
    private String createdAt;
}
