package com.itwanger.pairesume.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.common.ResumeAnalysisScenario;
import com.itwanger.pairesume.entity.ResumeModule;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiServiceImplResumeAnalysisPromptTest {
    @Test
    void workingProfessionalPromptKeepsScenarioBoundary() {
        var aiService = new AiServiceImpl(new ObjectMapper());
        var module = new ResumeModule();
        module.setId(1L);
        module.setModuleType("work_experience");
        module.setSortOrder(1);
        module.setContent(Map.of("company", "示例公司", "position", "开发工程师"));

        String prompt = ReflectionTestUtils.invokeMethod(
                aiService,
                "buildResumeAnalysisPrompt",
                "后端工程师简历",
                List.of(module),
                ResumeAnalysisScenario.WORKING_PROFESSIONAL.getDefaultPrompt()
        );

        assertTrue(prompt.contains("工作党不要求实习经历"));
        assertTrue(prompt.contains("不得用其他场景的要求扣分"));
        assertFalse(prompt.contains("工作经历、实习经历和项目经历都很重要"));
        assertFalse(prompt.contains("## 用户提示词"));
    }
}
