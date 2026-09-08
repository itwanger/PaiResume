package com.itwanger.pairesume.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.dto.AiFieldOptimizeRequestDTO;
import com.itwanger.pairesume.dto.FieldOptimizePromptConfigDTO;
import com.itwanger.pairesume.service.AiProviderConfigService;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ResearchFieldOptimizeTest {
    @ParameterizedTest
    @CsvSource({"research_background,background,科研背景,后台简介", "research_work_content,workContent,科研内容,后台职责", "research_achievements,achievements,研究成果,后台职责"})
    void researchFieldUsesSelectedAdminPromptAndOwnContent(String fieldType, String key, String title, String template) {
        var ai = spy(new AiServiceImpl(new ObjectMapper(), mock(AiProviderConfigService.class)));
        var config = new FieldOptimizePromptConfigDTO();
        config.setDescriptionPrompt("后台简介 {{original}}");
        config.setResponsibilityPrompt("后台职责 {{original}} / {{projectName}}");
        doReturn(config).when(ai).getFieldOptimizePromptConfig("asu");
        var request = new AiFieldOptimizeRequestDTO();
        request.setFieldType(fieldType);
        request.setPresetId("asu");
        Map<String, Object> content = Map.of("projectName", "科研项目", "background", "原始背景", "workContent", "原始工作", "achievements", "原始成果");
        var plan = ReflectionTestUtils.invokeMethod(ai, "prepareFieldOptimizePlan", "research", content, request);
        assertEquals(content.get(key), ReflectionTestUtils.getField(plan, "originalText"));
        assertEquals(fieldType, ReflectionTestUtils.getField(plan, "fieldType"));
        assertEquals(true, ReflectionTestUtils.getField(plan, "candidateOutput"));
        String prompt = (String) ReflectionTestUtils.getField(plan, "prompt");
        assertTrue(prompt.contains("「" + title + "」"));
        assertTrue(prompt.contains(template + " " + content.get(key)));
        verify(ai).getFieldOptimizePromptConfig("asu");
    }

    @Test
    void researchFieldRejectsEmptyAndUnknownTargets() {
        var ai = new AiServiceImpl(new ObjectMapper(), mock(AiProviderConfigService.class));
        for (var field : new String[]{"research_background", "research_work_content", "research_achievements", "projectName"}) {
            var request = new AiFieldOptimizeRequestDTO();
            request.setFieldType(field);
            assertThrows(BusinessException.class, () -> ReflectionTestUtils.invokeMethod(ai, "prepareFieldOptimizePlan", "research", Map.of(), request));
        }
    }
}
