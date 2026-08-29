package com.itwanger.pairesume.dto;

import lombok.Data;

import java.util.List;

@Data
public class ShowcaseAiReviewSectionDTO {
    private String moduleType;
    private String title;
    private String reason;
    private List<String> evidence;
}
