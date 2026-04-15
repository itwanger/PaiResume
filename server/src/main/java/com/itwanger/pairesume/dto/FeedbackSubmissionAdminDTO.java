package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class FeedbackSubmissionAdminDTO {
    private Long id;
    private String contactEmail;
    private String displayName;
    private String schoolOrCompany;
    private String targetRole;
    private Integer rating;
    private String testimonialText;
    private String desiredFeatures;
    private String bugFeedback;
    private boolean consentToPublish;
    private String reviewStatus;
    private String publishStatus;
    private String couponStatus;
    private String reviewNote;
    private Long reviewedBy;
    private String reviewedAt;
    private String createdAt;
    private CouponAdminDTO coupon;
}
