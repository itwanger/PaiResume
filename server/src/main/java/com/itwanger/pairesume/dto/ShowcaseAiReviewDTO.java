package com.itwanger.pairesume.dto;

import lombok.Data;

import java.util.List;

@Data
public class ShowcaseAiReviewDTO {
    private Integer scoreVersion;
    private ShowcaseAiScoreBreakdownDTO scoreBreakdown;
    private Integer overallScore;
    private String verdict;
    private List<ShowcaseAiReviewSectionDTO> sections;
    private List<String> improvements;
}
