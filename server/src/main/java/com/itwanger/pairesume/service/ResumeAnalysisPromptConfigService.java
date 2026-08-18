package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.ResumeAnalysisPromptConfigDTO;

import java.util.List;

public interface ResumeAnalysisPromptConfigService {
    int MAX_PROMPT_LENGTH = 12000;

    List<ResumeAnalysisPromptConfigDTO> listAdminConfigs();

    ResolvedPrompt resolve(String scenarioCode);

    ResumeAnalysisPromptConfigDTO update(String scenarioCode, String prompt, Long adminUserId);

    record ResolvedPrompt(String scenarioCode, String displayName, String prompt) {
    }
}
