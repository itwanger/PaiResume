package com.itwanger.pairesume.dto;

import lombok.Data;

import java.util.List;

@Data
public class HomeDTO {
    private Integer membershipPriceCents;
    private Integer questionnaireCouponAmountCents;
    private List<ShowcaseCardDTO> showcases;
    private List<PublishedFeedbackDTO> testimonials;
}
