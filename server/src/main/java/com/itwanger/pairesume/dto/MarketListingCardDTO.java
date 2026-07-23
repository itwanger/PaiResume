package com.itwanger.pairesume.dto;

import lombok.Data;

import java.util.List;

@Data
public class MarketListingCardDTO {
    private Long listingId;
    private String slug;
    private String title;
    private String summary;
    private List<String> tags;
    private String accessType;
    private Integer priceCents;
    private Long viewCount;
    private String publicationStatus;
    private String moderationStatus;
    private String updatedAt;
    private boolean paymentEnabled;
}
