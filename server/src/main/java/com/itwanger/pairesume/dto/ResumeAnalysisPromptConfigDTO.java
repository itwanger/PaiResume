package com.itwanger.pairesume.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ResumeAnalysisPromptConfigDTO {
    private String scenarioCode;
    private String displayName;
    private String prompt;
    private LocalDateTime updatedAt;
}
