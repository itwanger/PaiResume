package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ResumeAnalysisRequestDTO {
    @NotBlank(message = "请选择求职场景")
    private String scenarioCode;
}
