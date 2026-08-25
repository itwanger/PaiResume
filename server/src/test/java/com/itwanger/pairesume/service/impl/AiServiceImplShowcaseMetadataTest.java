package com.itwanger.pairesume.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.ShowcaseMetadataDTO;
import com.itwanger.pairesume.entity.ResumeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AiServiceImplShowcaseMetadataTest {
    private static final String VALID_SUMMARY =
            "这份简历聚焦 Java 后端开发，包含 Spring Boot 服务、数据库设计、接口治理与稳定性优化等真实工程实践。";

    private AiServiceImpl aiService;

    @BeforeEach
    void setUp() {
        aiService = new AiServiceImpl(new ObjectMapper(), aiProviderConfigStub());
    }

    @Test
    void acceptsMetadataWithinPublicCardContract() {
        ShowcaseMetadataDTO result = parse(json("Java 后端", VALID_SUMMARY));

        assertEquals("Java 后端", result.getDisplayLabel());
        assertEquals(VALID_SUMMARY, result.getSummary());
    }

    @Test
    void rejectsScoreLikeDisplayLabel() {
        assertInvalid(json("92 分", VALID_SUMMARY));
    }

    @Test
    void rejectsShortSummary() {
        assertInvalid(json("Java 后端", "内容太短"));
    }

    @Test
    void rejectsContactInformation() {
        String summary = VALID_SUMMARY + " 联系电话 13800138000。";

        assertInvalid(json("Java 后端", summary));
    }

    @Test
    void rejectsPrivateBasicInfoRepeatedByAi() {
        ShowcaseMetadataDTO metadata = parse(json(
                "Java 后端",
                "张三的简历聚焦 Java 后端开发，包含 Spring Boot 服务、数据库设计与稳定性优化等真实工程实践。"
        ));
        ResumeModule basicInfo = new ResumeModule();
        basicInfo.setModuleType("basic_info");
        basicInfo.setContent(Map.of("name", "张三"));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> ReflectionTestUtils.invokeMethod(
                        aiService,
                        "validateShowcaseMetadataAgainstPrivateInfo",
                        metadata,
                        List.of(basicInfo)
                )
        );

        assertEquals(ResultCode.AI_RESPONSE_INVALID.getCode(), exception.getCode());
    }

    private ShowcaseMetadataDTO parse(String response) {
        return ReflectionTestUtils.invokeMethod(aiService, "parseShowcaseMetadataResponse", response);
    }

    private void assertInvalid(String response) {
        BusinessException exception = assertThrows(BusinessException.class, () -> parse(response));
        assertEquals(ResultCode.AI_RESPONSE_INVALID.getCode(), exception.getCode());
    }

    private String json(String displayLabel, String summary) {
        try {
            return new ObjectMapper().writeValueAsString(Map.of(
                    "displayLabel", displayLabel,
                    "summary", summary
            ));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static com.itwanger.pairesume.service.AiProviderConfigService aiProviderConfigStub() {
        var stub = org.mockito.Mockito.mock(com.itwanger.pairesume.service.AiProviderConfigService.class);
        org.mockito.Mockito.when(stub.resolveActive()).thenReturn(
                new com.itwanger.pairesume.service.AiProviderConfigService.ActiveAiConfig(
                        "test", "http://localhost/v1", "test-key", "general-model", "analysis-model", false));
        return stub;
    }
}
