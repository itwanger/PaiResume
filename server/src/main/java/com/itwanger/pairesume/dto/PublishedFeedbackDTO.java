package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class PublishedFeedbackDTO {
    private Long id;
    private String displayName;
    private String schoolOrCompany;
    private String targetRole;
    private Integer rating;
    private String testimonialText;
    private String createdAt;
}
