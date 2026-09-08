package com.itwanger.pairesume.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.dto.AiFieldOptimizeRequestDTO;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.service.AiProviderConfigService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.util.ReflectionTestUtils;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class FieldOptimizePromptServiceTest {
    @Test
    void savedTemplatesSurviveServiceRecreationAndDriveSelectedOptimization() throws Exception {
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(
                "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", ""));
        jdbc.execute(Files.readString(Path.of("src/main/resources/db/migration/V45__create_field_optimize_prompt_config.sql")));
        var store = new FieldOptimizePromptService(jdbc);
        var ai = new AiServiceImpl(new ObjectMapper(), mock(AiProviderConfigService.class));
        ReflectionTestUtils.setField(ai, "fieldOptimizePromptService", store);
        ReflectionTestUtils.setField(ai, "fieldOptimizePromptConfigFile", "../config/field-optimize-prompts.yml");
        var standard = ai.getFieldOptimizePromptConfig("standard");
        var asu = ai.getFieldOptimizePromptConfig("asu");
        assertTrue(asu.getSystemPrompt().contains("个人边界"));
        asu.setSystemPrompt("后台管理的系统提示词");
        asu.setResponsibilityPrompt("后台模板 {{original}} / {{company}}");
        store.save("asu", asu, 41L);
        asu.setDescription("突出事实和贡献");
        store.save("asu", asu, 42L);
        ReflectionTestUtils.setField(ai, "fieldOptimizePromptService", new FieldOptimizePromptService(jdbc));
        assertEquals("突出事实和贡献", ai.getFieldOptimizePromptConfig("asu").getDescription());
        assertEquals(42L, jdbc.queryForObject("SELECT updated_by FROM field_optimize_prompt_config", Long.class));
        assertEquals(standard.getSystemPrompt(), ai.getFieldOptimizePromptConfig("standard").getSystemPrompt());
        var request = new ObjectMapper().readValue("""
                {"fieldType":"responsibility","index":0,"presetId":"asu","prompt":"用户覆盖","systemPrompt":"用户覆盖"}
                """, AiFieldOptimizeRequestDTO.class);
        var plan = ReflectionTestUtils.invokeMethod(ai, "prepareFieldOptimizePlan", "work_experience",
                Map.of("company", "示例公司", "responsibilities", java.util.List.of("原始职责")), request);
        assertEquals("后台模板 原始职责 / 示例公司", ReflectionTestUtils.getField(plan, "prompt"));
        String actualSystemPrompt = ReflectionTestUtils.invokeMethod(ai, "resolveFieldSystemPrompt", request);
        assertTrue(actualSystemPrompt.startsWith("后台管理的系统提示词"));
        assertTrue(actualSystemPrompt.contains("candidateTags"));
        assertTrue(actualSystemPrompt.contains("量化方式遵循后台配置的字段提示词"));
        assertFalse(actualSystemPrompt.contains("不得返回 quantified 标签"));
        String legacy = "后台自定义要求\n" + FieldOptimizeCandidateMetadata.MARKER
                + "\n不得为了量化版补造数字、算法、技术栈或成果。原文没有数字依据时用定性成果，且不得返回 quantified 标签。";
        assertFalse(FieldOptimizeCandidateMetadata.withInstructions(legacy).contains("不得返回 quantified 标签"));
        assertTrue(FieldOptimizeCandidateMetadata.withInstructions(legacy).startsWith("后台自定义要求"));
        assertEquals(actualSystemPrompt, ai.getFieldOptimizePromptConfig("asu").getSystemPrompt());
        assertEquals(actualSystemPrompt, FieldOptimizeCandidateMetadata.withInstructions(actualSystemPrompt));
        asu.setSkillPrompt("丢失原文占位符");
        assertThrows(BusinessException.class, () -> store.save("asu", asu, 41L));
        assertThrows(BusinessException.class, () -> ai.getFieldOptimizePromptConfig("custom"));
    }
}
