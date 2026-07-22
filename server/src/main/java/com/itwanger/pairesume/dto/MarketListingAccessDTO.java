package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class MarketListingAccessDTO {
    private Long listingId;
    private String slug;
    private String accessStatus;
    private boolean canView;
    private String accessType;
    private Integer priceCents;
    private Long revisionId;
    private boolean paymentEnabled;
}
