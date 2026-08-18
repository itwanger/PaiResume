package com.itwanger.pairesume.dto;

import com.itwanger.pairesume.service.ResumeAnalysisPromptConfigService;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UpdateResumeAnalysisPromptDTOTest {

    @Test
    void promptMustBePresentAndWithinInterfaceBoundaryLimit() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            UpdateResumeAnalysisPromptDTO dto = new UpdateResumeAnalysisPromptDTO();

            dto.setPrompt("工作党分析提示词");
            assertTrue(validator.validate(dto).isEmpty());

            dto.setPrompt("字".repeat(ResumeAnalysisPromptConfigService.MAX_PROMPT_LENGTH));
            assertTrue(validator.validate(dto).isEmpty());

            dto.setPrompt(null);
            assertEquals(1, validator.validate(dto).size());

            dto.setPrompt("   ");
            assertEquals(1, validator.validate(dto).size());

            dto.setPrompt("字".repeat(ResumeAnalysisPromptConfigService.MAX_PROMPT_LENGTH + 1));
            assertEquals(1, validator.validate(dto).size());
        }
    }
}
