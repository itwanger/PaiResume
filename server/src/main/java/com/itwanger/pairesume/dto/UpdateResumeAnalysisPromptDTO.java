package com.itwanger.pairesume.dto;

import com.itwanger.pairesume.service.ResumeAnalysisPromptConfigService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateResumeAnalysisPromptDTO {
    @NotBlank(message = "分析提示词不能为空")
    @Size(max = ResumeAnalysisPromptConfigService.MAX_PROMPT_LENGTH, message = "分析提示词不能超过 12000 个字符")
    private String prompt;
}
