package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class ShowcaseAiScoreBreakdownDTO {
    private Integer contentCompleteness;
    private Integer jobRelevance;
    private Integer evidenceQuality;
    private Integer expressionQuality;
}
