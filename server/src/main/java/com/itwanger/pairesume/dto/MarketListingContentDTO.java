package com.itwanger.pairesume.dto;

import lombok.Data;

import java.util.List;

@Data
public class MarketListingContentDTO {
    private Long listingId;
    private Long revisionId;
    private String slug;
    private String title;
    private String templateId;
    private String summary;
    private List<String> tags;
    private List<MarketResumeModuleDTO> modules;
    private String accessType;
    private Integer priceCents;
}
