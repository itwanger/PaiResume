package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class ShowcaseMetadataDTO {
    private String displayLabel;
    private String summary;
    private ShowcaseAiReviewDTO aiReview;
}
