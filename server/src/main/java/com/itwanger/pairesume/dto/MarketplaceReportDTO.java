package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class MarketplaceReportDTO {
    private Long id;
    private Long listingId;
    private String listingSlug;
    private String reportType;
    private String description;
    private String contact;
    private String processingStatus;
    private Long handledBy;
    private String handledReason;
    private String handledAt;
    private String createdAt;
    private String updatedAt;
}
