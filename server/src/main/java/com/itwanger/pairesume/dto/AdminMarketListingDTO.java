package com.itwanger.pairesume.dto;

import lombok.Data;

import java.util.List;

@Data
public class AdminMarketListingDTO {
    private Long id;
    private Long resumeId;
    private Long sellerUserId;
    private String slug;
    private String title;
    private String summary;
    private List<String> tags;
    private String accessType;
    private Integer priceCents;
    private String publicationStatus;
    private String moderationStatus;
    private Long moderatedBy;
    private String moderatedAt;
    private String moderationReason;
    private Long currentRevisionId;
    private String createdAt;
    private String updatedAt;
}
