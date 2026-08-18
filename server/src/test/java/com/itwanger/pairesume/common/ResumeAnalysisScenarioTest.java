package com.itwanger.pairesume.common;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ResumeAnalysisScenarioTest {
    @Test
    void workingProfessionalDoesNotRequireInternshipOrStandaloneProject() {
        String prompt = ResumeAnalysisScenario.WORKING_PROFESSIONAL.getDefaultPrompt();

        assertTrue(prompt.contains("工作党不要求实习经历"));
        assertTrue(prompt.contains("不得因缺少或填写实习经历单独加分或扣分"));
        assertTrue(prompt.contains("不要求论文期刊、科研经历和独立项目经历"));
        assertFalse(prompt.contains("必须要实习经历"));
    }

    @Test
    void rejectsMissingOrUnknownScenario() {
        assertThrows(BusinessException.class, () -> ResumeAnalysisScenario.fromCode(null));
        assertThrows(BusinessException.class, () -> ResumeAnalysisScenario.fromCode("unknown"));
    }
}
