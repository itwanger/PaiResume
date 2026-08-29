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
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
        assertEquals(83, result.getAiReview().getOverallScore());
        assertEquals(2, result.getAiReview().getScoreVersion());
        assertEquals("project", result.getAiReview().getSections().get(0).getModuleType());
    }

    @Test
    void promptRequiresIndependentWeightedScoringWithoutFixedOverallScore() {
        ResumeModule project = new ResumeModule();
        project.setModuleType("project");
        project.setContent(Map.of("description", "实现订单异步处理链路并将响应时间降低至百毫秒级"));

        String prompt = ReflectionTestUtils.invokeMethod(
                aiService,
                "buildShowcaseMetadataPrompt",
                "Java 后端简历",
                List.of(project)
        );

        assertFalse(prompt.contains("\"overallScore\""));
        assertFalse(prompt.contains("\"overallScore\": 88"));
        assertTrue(prompt.contains("固定分或默认分"));
        assertTrue(prompt.contains("contentCompleteness 内容完整度 0-25"));
        assertTrue(prompt.contains("evidenceQuality 可核验事实与量化证据 0-30"));
        assertTrue(prompt.contains("实现订单异步处理链路并将响应时间降低至百毫秒级"));
    }

    @Test
    void computesOverallScoreFromBreakdownInsteadOfTrustingModelTotal() {
        Map<String, Object> review = new LinkedHashMap<>(reviewWithScores(
                "project", "项目经历", "使用 Spring Boot 实现核心服务并完成稳定性优化",
                17, 19, 22, 14
        ));
        review.put("overallScore", 99);

        ShowcaseMetadataDTO result = parse(json("Java 后端", VALID_SUMMARY, review));

        assertEquals(72, result.getAiReview().getOverallScore());
    }

    @Test
    void rejectsScoreBreakdownOutsideDimensionRange() {
        assertInvalid(json(
                "Java 后端",
                VALID_SUMMARY,
                reviewWithScores(
                        "project", "项目经历", "使用 Spring Boot 实现核心服务并完成稳定性优化",
                        26, 20, 24, 16
                )
        ));
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
    void truncatesLongSummaryInsteadOfRejectingUsableMetadata() {
        String longSummary = "郑州大学计算机硕士，主攻AI应用开发。有淘宝闪购AI应用实习经历，参与RAG知识库和终端Coding Agent项目，"
                + "熟悉Spring AI、LangChain4j、RAG及Agent架构，获国家励志奖学金。";

        ShowcaseMetadataDTO result = parse(json("AI应用开发", longSummary));

        assertEquals(100, result.getSummary().length());
        assertEquals("…", result.getSummary().substring(99));
    }

    @Test
    void rejectsContactInformation() {
        String summary = VALID_SUMMARY + " 联系电话 13800138000。";

        assertInvalid(json("Java 后端", summary));
    }

    @Test
    void rejectsContactInformationEvenWhenItAppearsAfterSummaryLimit() {
        String summary = "这份简历聚焦 Java 后端开发，包含 Spring Boot 服务、数据库设计、接口治理与稳定性优化等真实工程实践。"
                + "同时具备需求分析、系统设计、性能优化和线上问题排查经验，并能推动跨团队协作交付。"
                + " 联系电话 13800138000。";

        assertInvalid(json("Java 后端", summary));
    }

    @Test
    void rejectsContactInformationInsideReviewEvidence() {
        assertInvalid(json(
                "Java 后端",
                VALID_SUMMARY,
                review("project", "项目经历", "可联系 project@example.com 核验项目结果")
        ));
    }

    @Test
    void rejectsReviewSectionForModuleThatDoesNotExist() {
        ShowcaseMetadataDTO metadata = parse(json(
                "Java 后端",
                VALID_SUMMARY,
                review("skill", "专业技能")
        ));
        ResumeModule project = new ResumeModule();
        project.setModuleType("project");
        project.setContent(Map.of("description", "实现 Java 服务端与 AI 应用开发"));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> ReflectionTestUtils.invokeMethod(
                        aiService,
                        "validateShowcaseReviewAgainstModules",
                        metadata,
                        List.of(project)
                )
        );

        assertEquals(ResultCode.AI_RESPONSE_INVALID.getCode(), exception.getCode());
    }

    @Test
    void acceptsReviewEvidenceCopiedFromMatchingModule() {
        ShowcaseMetadataDTO metadata = parse(json(
                "Java 后端",
                VALID_SUMMARY,
                review("project", "项目经历", "实现 Java 服务端与 AI 应用开发")
        ));
        ResumeModule project = new ResumeModule();
        project.setModuleType("project");
        project.setContent(Map.of("description", "负责并实现 Java 服务端与 AI 应用开发，完成核心链路交付"));

        ReflectionTestUtils.invokeMethod(
                aiService,
                "validateShowcaseReviewAgainstModules",
                metadata,
                List.of(project)
        );
    }

    @Test
    void replacesUnverifiedEvidenceWithSourceExcerpt() {
        ShowcaseMetadataDTO metadata = parse(json(
                "Java 后端",
                VALID_SUMMARY,
                review("project", "项目经历", "概括后的项目成效并非原文摘录")
        ));
        ResumeModule project = new ResumeModule();
        project.setModuleType("project");
        project.setContent(Map.of(
                "description", "负责 Java 服务端与 AI 应用开发，完成核心链路交付"
        ));

        ReflectionTestUtils.invokeMethod(
                aiService,
                "validateShowcaseReviewAgainstModules",
                metadata,
                List.of(project)
        );

        assertEquals(
                List.of("负责 Java 服务端与 AI 应用开发，完成核心链路交付"),
                metadata.getAiReview().getSections().get(0).getEvidence()
        );
    }

    @Test
    void replacesTooShortEvidenceWithSourceExcerpt() {
        ShowcaseMetadataDTO metadata = parse(json(
                "Java 后端",
                VALID_SUMMARY,
                review("project", "项目经历", "提效")
        ));
        ResumeModule project = new ResumeModule();
        project.setModuleType("project");
        project.setContent(Map.of(
                "description", "通过缓存与异步任务优化核心链路响应速度"
        ));

        ReflectionTestUtils.invokeMethod(
                aiService,
                "validateShowcaseReviewAgainstModules",
                metadata,
                List.of(project)
        );

        assertEquals(
                List.of("通过缓存与异步任务优化核心链路响应速度"),
                metadata.getAiReview().getSections().get(0).getEvidence()
        );
    }

    @Test
    void replacesInternalMapSyntaxWithReadableSkillEvidence() {
        ShowcaseMetadataDTO metadata = parse(json(
                "Java 后端",
                VALID_SUMMARY,
                review(
                        "skill",
                        "专业技能",
                        "categories: {name=后端开发, items=[Java, Spring Boot, MySQL, Redis]}"
                )
        ));
        ResumeModule skill = new ResumeModule();
        skill.setModuleType("skill");
        skill.setContent(Map.of(
                "categories", List.of(Map.of(
                        "name", "后端开发",
                        "items", List.of("Java", "Spring Boot", "MySQL", "Redis")
                ))
        ));

        ReflectionTestUtils.invokeMethod(
                aiService,
                "validateShowcaseReviewAgainstModules",
                metadata,
                List.of(skill)
        );

        var evidence = metadata.getAiReview().getSections().get(0).getEvidence();
        assertFalse(evidence.stream().anyMatch(item -> item.contains("=") || item.contains("categories:")));
        assertTrue(evidence.stream().anyMatch(item -> item.contains("Spring Boot")));
    }

    @Test
    void fallbackSkipsProjectIdAndPureDatesInNestedProjectData() {
        ShowcaseMetadataDTO metadata = parse(json(
                "Java 后端",
                VALID_SUMMARY,
                review("project", "项目经历", "概括后的项目成效并非原文摘录")
        ));
        ResumeModule project = new ResumeModule();
        project.setModuleType("project");
        project.setContent(Map.of(
                "projects", List.of(Map.of(
                        "id", "01890f47-6c98-7cc2-b0b2-9f157a0f4a21",
                        "startDate", "2023年9月",
                        "endDate", "2024年6月",
                        "projectDescription", "设计并实现订单异步处理链路，将核心接口响应时间降低至百毫秒级"
                ))
        ));

        ReflectionTestUtils.invokeMethod(
                aiService,
                "validateShowcaseReviewAgainstModules",
                metadata,
                List.of(project)
        );

        assertEquals(
                List.of("设计并实现订单异步处理链路，将核心接口响应时间降低至百毫秒级"),
                metadata.getAiReview().getSections().get(0).getEvidence()
        );
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

    @Test
    void acceptsOrdinaryCityMentionedInSummaryAndReview() {
        ShowcaseMetadataDTO metadata = parse(json(
                "Java 后端",
                "候选人在北京参与 Java 后端开发，包含 Spring Boot 服务、数据库设计、接口治理与稳定性优化等真实工程实践。",
                review("project", "项目经历", "在北京完成核心服务开发与稳定性优化")
        ));
        ResumeModule basicInfo = new ResumeModule();
        basicInfo.setModuleType("basic_info");
        basicInfo.setContent(Map.of("hometown", "北京"));

        ReflectionTestUtils.invokeMethod(
                aiService,
                "validateShowcaseMetadataAgainstPrivateInfo",
                metadata,
                List.of(basicInfo)
        );
    }

    private ShowcaseMetadataDTO parse(String response) {
        return ReflectionTestUtils.invokeMethod(aiService, "parseShowcaseMetadataResponse", response);
    }

    private void assertInvalid(String response) {
        BusinessException exception = assertThrows(BusinessException.class, () -> parse(response));
        assertEquals(ResultCode.AI_RESPONSE_INVALID.getCode(), exception.getCode());
    }

    private String json(String displayLabel, String summary) {
        return json(displayLabel, summary, review("project", "项目经历"));
    }

    private String json(String displayLabel, String summary, Map<String, Object> aiReview) {
        try {
            return new ObjectMapper().writeValueAsString(Map.of(
                    "displayLabel", displayLabel,
                    "summary", summary,
                    "aiReview", aiReview
            ));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private Map<String, Object> review(String moduleType, String title) {
        return review(moduleType, title, "使用 Spring Boot 实现核心服务并完成稳定性优化");
    }

    private Map<String, Object> review(String moduleType, String title, String evidence) {
        return reviewWithScores(moduleType, title, evidence, 21, 21, 25, 16);
    }

    private Map<String, Object> reviewWithScores(
            String moduleType,
            String title,
            String evidence,
            int contentCompleteness,
            int jobRelevance,
            int evidenceQuality,
            int expressionQuality
    ) {
        return Map.of(
                "scoreVersion", 2,
                "scoreBreakdown", Map.of(
                        "contentCompleteness", contentCompleteness,
                        "jobRelevance", jobRelevance,
                        "evidenceQuality", evidenceQuality,
                        "expressionQuality", expressionQuality
                ),
                "verdict", "项目经历有清晰的技术行动与结果证据，岗位匹配度较高。",
                "sections", List.of(Map.of(
                        "moduleType", moduleType,
                        "title", title,
                        "reason", "内容能说明技术方案、承担工作和交付结果，事实证据较为完整。",
                        "evidence", List.of(evidence)
                )),
                "improvements", List.of("可进一步补充更多可量化的业务结果")
        );
    }

    private static com.itwanger.pairesume.service.AiProviderConfigService aiProviderConfigStub() {
        var stub = org.mockito.Mockito.mock(com.itwanger.pairesume.service.AiProviderConfigService.class);
        org.mockito.Mockito.when(stub.resolveActive()).thenReturn(
                new com.itwanger.pairesume.service.AiProviderConfigService.ActiveAiConfig(
                        "DEEPSEEK", "test", "http://localhost/v1", "test-key",
                        "general-model", "analysis-model", false));
        return stub;
    }
}
