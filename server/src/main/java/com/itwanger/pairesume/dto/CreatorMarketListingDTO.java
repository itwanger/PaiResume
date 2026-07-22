package com.itwanger.pairesume.dto;

import lombok.Data;

import java.util.List;

@Data
public class CreatorMarketListingDTO {
    private Long id;
    private Long resumeId;
    private String slug;
    private String title;
    private String summary;
    private List<String> tags;
    private String accessType;
    private Integer priceCents;
    private String publicationStatus;
    private String moderationStatus;
    private String moderationReason;
    private Long currentRevisionId;
    private boolean snapshotOutdated;
    private String createdAt;
    private String updatedAt;
}
