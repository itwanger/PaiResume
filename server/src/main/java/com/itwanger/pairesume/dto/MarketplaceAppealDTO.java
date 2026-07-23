package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class MarketplaceAppealDTO {
    private Long id;
    private Long listingId;
    private Long listingRevisionId;
    private Long creatorUserId;
    private String appealType;
    private String description;
    private String appealStatus;
    private Long handledBy;
    private String handledReason;
    private String handledAt;
    private String createdAt;
    private String updatedAt;
}
