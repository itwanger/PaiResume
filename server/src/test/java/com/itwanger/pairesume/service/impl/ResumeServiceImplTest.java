package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.dto.ResumeCreateDTO;
import com.itwanger.pairesume.dto.ResumeStyleUpdateDTO;
import com.itwanger.pairesume.dto.ResumeUpdateDTO;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.service.ResumeMarketplaceService;
import com.itwanger.pairesume.service.ResumeShowcaseService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResumeServiceImplTest {
    @Mock private ResumeMapper resumeMapper;
    @Mock private ResumeModuleMapper resumeModuleMapper;
    @Mock private ResumeMarketplaceService resumeMarketplaceService;
    @Mock private ResumeShowcaseService resumeShowcaseService;

    private ResumeServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ResumeServiceImpl(
                resumeMapper,
                resumeModuleMapper,
                resumeMarketplaceService,
                resumeShowcaseService
        );
        ReflectionTestUtils.setField(service, "maxResumeCountPerUser", 20);
    }

    @Test
    void listBuildsMeaningfulCardPreviewFromModulesInOneBatch() {
        Resume resume = new Resume();
        resume.setId(11L);
        resume.setUserId(7L);
        resume.setTitle("AI 应用开发工程师求职简历");
        resume.setTemplateId("default");
        when(resumeMapper.selectList(any())).thenReturn(List.of(resume));

        ResumeModule basic = module(11L, "basic_info", Map.of(
                "name", "张天霸",
                "jobIntention", "Agent 工程师",
                "email", "private@example.com"));
        ResumeModule education = module(11L, "education", Map.of(
                "school", "郑州大学",
                "degree", "本科",
                "major", "计算机科学与技术"));
        ResumeModule master = module(11L, "education", Map.of(
                "school", "西安电子科技大学",
                "degree", "硕士",
                "major", "人工智能"));
        ResumeModule work = module(11L, "work_experience", Map.of(
                "company", "示例科技",
                "position", "Java 开发工程师",
                "projects", List.of(
                        Map.of(
                                "projectName", "智能客服",
                                "role", "核心开发",
                                "projectDescription", "不应优先展示的项目简介",
                                "responsibilities", List.of(
                                        "主导 RAG 多路召回与重排链路，将答案命中率提升至 92%",
                                        "构建离线评测集并接入自动化回归"),
                                "techStack", "Java, Spring AI, Milvus"),
                        Map.of(
                                "projectName", "风控平台",
                                "role", "后端开发",
                                "projectDescription", "不应优先展示的风控项目简介",
                                "responsibilities", List.of("负责实时规则引擎与告警链路，核心接口延迟控制在 80ms"),
                                "techStack", "Flink, Redis"))));
        ResumeModule internship = module(11L, "internship", Map.of(
                "company", "字节跳动",
                "position", "后端实习生",
                "projects", List.of(Map.of(
                        "projectName", "终端 Coding Agent",
                        "role", "Agent 开发",
                        "responsibilities", List.of(
                                "基于 LangGraph4j StateGraph 构建工作流引擎，实现 GraphBuilder 节点注册和边连接、NodeAdapter 适配器桥接现有执行器、StateManager 管理节点间状态传递。",
                                "设计 ChatClientFactory 动态工厂，运行时根据节点配置创建 ChatClient，实现多厂商 LLM 无缝切换。"),
                        "techStack", "TypeScript, Function Calling"))));
        ResumeModule secondWork = module(11L, "work_experience", Map.of(
                "company", "开源社区",
                "position", "AI 应用开发者"));
        ResumeModule project = module(11L, "project", Map.of(
                "projectName", "派聪明 RAG",
                "role", "核心开发",
                "description", "不应优先展示的独立项目简介",
                "achievements", List.of(
                        "设计混合检索与评测体系，召回准确率提升 18%",
                        "实现文档解析、切块、Embedding 与检索重排链路"),
                "techStack", "LangChain4j, Elasticsearch"));
        ResumeModule skill = module(11L, "skill", Map.of(
                "categories", List.of(Map.of("name", "后端", "items", List.of("Java", "Spring Boot", "MySQL")))));
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(
                basic, education, master, work, internship, secondWork, project, skill));

        var result = service.listByUserId(7L);

        assertEquals(1, result.size());
        assertEquals("张天霸", result.get(0).getPreview().getName());
        assertEquals("Agent 工程师", result.get(0).getPreview().getTargetRole());
        assertEquals("Agent 工程师", result.get(0).getPreview().getBasicInfo());
        assertEquals("郑州大学 · 本科 · 计算机科学与技术", result.get(0).getPreview().getEducation());
        assertEquals(List.of(
                "郑州大学 · 本科 · 计算机科学与技术",
                "西安电子科技大学 · 硕士 · 人工智能"), result.get(0).getPreview().getEducations());
        assertEquals("主导 RAG 多路召回与重排链路，将答案命中率提升至 92%",
                result.get(0).getPreview().getExperience());
        assertEquals(List.of(
                "主导 RAG 多路召回与重排链路，将答案命中率提升至 92%",
                "基于 LangGraph4j StateGraph 构建工作流引擎，实现 GraphBuilder 节点注册和边连接、NodeAdapter 适配器桥接现有执行器、StateManager 管理节点间状态传递。"),
                result.get(0).getPreview().getExperiences());
        assertEquals(List.of(
                "主导 RAG 多路召回与重排链路，将答案命中率提升至 92%",
                "负责实时规则引擎与告警链路，核心接口延迟控制在 80ms"),
                result.get(0).getPreview().getWorkExperiences());
        assertEquals(List.of(
                "基于 LangGraph4j StateGraph 构建工作流引擎，实现 GraphBuilder 节点注册和边连接、NodeAdapter 适配器桥接现有执行器、StateManager 管理节点间状态传递。",
                "设计 ChatClientFactory 动态工厂，运行时根据节点配置创建 ChatClient，实现多厂商 LLM 无缝切换。"),
                result.get(0).getPreview().getInternships());
        assertEquals("派聪明 RAG · 核心开发", result.get(0).getPreview().getProject());
        assertEquals(2, result.get(0).getPreview().getProjects().size());
        assertEquals("设计混合检索与评测体系，召回准确率提升 18%",
                result.get(0).getPreview().getProjects().get(0).getDescription());
        assertEquals("实现文档解析、切块、Embedding 与检索重排链路",
                result.get(0).getPreview().getProjects().get(1).getDescription());
        assertEquals(List.of(
                "Java", "Spring Boot", "MySQL", "Spring AI", "Milvus", "Flink", "Redis", "TypeScript"),
                result.get(0).getPreview().getSkills());
        assertEquals(8, result.get(0).getPreview().getFilledModuleCount());
    }

    @Test
    void cardPreviewKeepsLegacyFlatExperienceResponsibilities() {
        ResumeModule legacyWork = module(11L, "work_experience", Map.of(
                "company", "旧数据科技",
                "position", "后端工程师",
                "projectName", "交易平台",
                "projectDescription", "不应优先展示的旧项目简介",
                "responsibilities", "项目简介：不应当成职责\n核心职责：负责交易链路重构并降低故障率\n- 建立压测与容量评估体系"));

        var preview = ResumeServiceImpl.buildCardPreview(List.of(legacyWork));

        assertEquals(List.of(
                "负责交易链路重构并降低故障率",
                "建立压测与容量评估体系"),
                preview.getExperiences());
        assertEquals(preview.getExperiences(), preview.getWorkExperiences());
        assertTrue(preview.getInternships().isEmpty());
        assertTrue(preview.getProjects().isEmpty());
    }

    private ResumeModule module(Long resumeId, String type, Map<String, Object> content) {
        ResumeModule module = new ResumeModule();
        module.setResumeId(resumeId);
        module.setModuleType(type);
        module.setContent(content);
        return module;
    }

    @Test
    void creatingResumeTrimsRequiredTitleBeforeInsert() {
        when(resumeMapper.selectCount(any())).thenReturn(0L);
        ResumeCreateDTO dto = new ResumeCreateDTO();
        dto.setTitle("\u3000Java 后端求职简历\u3000");

        service.create(7L, dto);

        ArgumentCaptor<Resume> resumeCaptor = ArgumentCaptor.forClass(Resume.class);
        verify(resumeMapper).insert(resumeCaptor.capture());
        assertEquals("Java 后端求职简历", resumeCaptor.getValue().getTitle());
    }

    @Test
    void creatingResumeRejectsBlankTitleBeforeDatabaseAccess() {
        ResumeCreateDTO dto = new ResumeCreateDTO();

        dto.setTitle(null);
        assertThrows(BusinessException.class, () -> service.create(7L, dto));

        dto.setTitle("\u3000");
        assertThrows(BusinessException.class, () -> service.create(7L, dto));

        dto.setTitle("简".repeat(129));
        assertThrows(BusinessException.class, () -> service.create(7L, dto));

        verifyNoInteractions(resumeMapper);
    }

    @Test
    void deletingResumeAlsoUnpublishesMarketplaceListing() {
        Resume resume = new Resume();
        resume.setId(11L);
        resume.setUserId(7L);
        resume.setStatus(1);
        when(resumeMapper.selectById(11L)).thenReturn(resume);
        when(resumeMapper.deleteById(11L)).thenReturn(1);

        service.delete(7L, 11L);

        verify(resumeMapper).deleteById(11L);
        verify(resumeMarketplaceService).unpublishDeletedResume(11L, 7L);
        verify(resumeShowcaseService).unpublishDeletedResume(11L);
    }

    @Test
    void renamingResumeKeepsFeaturedVersionPublished() {
        Resume resume = new Resume();
        resume.setId(11L);
        resume.setUserId(7L);
        resume.setStatus(1);
        when(resumeMapper.selectById(11L)).thenReturn(resume);
        ResumeModule basicInfo = module(11L, "basic_info", Map.of(
                "name", "张天霸",
                "jobIntention", "Agent 工程师"));
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(basicInfo));
        ResumeUpdateDTO dto = new ResumeUpdateDTO();
        dto.setTitle("AI 应用开发简历");

        var result = service.update(7L, 11L, dto);

        assertEquals("AI 应用开发简历", result.getTitle());
        assertEquals("张天霸", result.getPreview().getName());
        assertEquals("Agent 工程师", result.getPreview().getTargetRole());
        assertEquals(1, result.getPreview().getFilledModuleCount());
        verify(resumeMapper).updateById(resume);
        verifyNoInteractions(resumeShowcaseService);
    }

    @Test
    void updatingStylePersistsResumeOwnedPdfConfiguration() {
        Resume resume = new Resume();
        resume.setId(11L);
        resume.setUserId(7L);
        resume.setStatus(1);
        when(resumeMapper.selectById(11L)).thenReturn(resume);
        ResumeStyleUpdateDTO dto = new ResumeStyleUpdateDTO();
        dto.setPageMode("continuous");
        dto.setTemplateId("warm");
        dto.setDensity("compact");
        dto.setAccentPreset("warm");
        dto.setHeadingStyle("filled");

        var result = service.updateStyle(7L, 11L, dto);

        assertEquals("continuous", resume.getPageMode());
        assertEquals("warm", resume.getTemplateId());
        assertEquals("compact", resume.getPdfDensity());
        assertEquals("warm", resume.getAccentPreset());
        assertEquals("filled", resume.getHeadingStyle());
        assertEquals("continuous", result.getPageMode());
        assertEquals("warm", result.getTemplateId());
        assertEquals("compact", result.getDensity());
        assertEquals("warm", result.getAccentPreset());
        assertEquals("filled", result.getHeadingStyle());
        verify(resumeMapper).updateById(resume);
        verifyNoInteractions(resumeShowcaseService);
    }

    @Test
    void failedOwnershipCheckDoesNotTouchMarketplaceListing() {
        Resume resume = new Resume();
        resume.setId(11L);
        resume.setUserId(8L);
        resume.setStatus(1);
        when(resumeMapper.selectById(11L)).thenReturn(resume);

        assertThrows(BusinessException.class, () -> service.delete(7L, 11L));

        verify(resumeMapper, never()).deleteById(11L);
        verifyNoInteractions(resumeMarketplaceService);
        verifyNoInteractions(resumeShowcaseService);
    }

    @Test
    void failedLogicalDeleteDoesNotTouchMarketplaceListing() {
        Resume resume = new Resume();
        resume.setId(11L);
        resume.setUserId(7L);
        resume.setStatus(1);
        when(resumeMapper.selectById(11L)).thenReturn(resume);
        when(resumeMapper.deleteById(11L)).thenReturn(0);

        assertThrows(BusinessException.class, () -> service.delete(7L, 11L));

        verifyNoInteractions(resumeMarketplaceService);
        verifyNoInteractions(resumeShowcaseService);
    }
}
