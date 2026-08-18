package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.ResumeShowcaseUpsertDTO;
import com.itwanger.pairesume.dto.ShowcaseMetadataDTO;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.entity.ResumeShowcase;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.mapper.ResumeShowcaseMapper;
import com.itwanger.pairesume.service.AiService;
import com.itwanger.pairesume.service.MembershipService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResumeShowcaseServiceImplTest {

    @Mock
    private ResumeShowcaseMapper resumeShowcaseMapper;
    @Mock
    private ResumeMapper resumeMapper;
    @Mock
    private ResumeModuleMapper resumeModuleMapper;
    @Mock
    private MembershipService membershipService;
    @Mock
    private AiService aiService;

    private ResumeShowcaseServiceImpl resumeShowcaseService;

    @BeforeEach
    void setUp() {
        resumeShowcaseService = new ResumeShowcaseServiceImpl(
                resumeShowcaseMapper,
                resumeMapper,
                resumeModuleMapper,
                membershipService,
                aiService
        );
    }

    @Test
    void publicListIncludesFreeAndVipShowcaseCards() {
        ResumeShowcase freeShowcase = showcase("FREE");
        ResumeShowcase vipShowcase = showcase("VIP");
        vipShowcase.setId(12L);
        vipShowcase.setResumeId(22L);
        vipShowcase.setSlug("excellent-product");

        Resume freeResume = resume();
        freeResume.setTemplateId("warm");
        freeResume.setPageMode("continuous");
        freeResume.setPdfDensity("compact");
        freeResume.setAccentPreset("warm");
        freeResume.setHeadingStyle("filled");
        Resume vipResume = resume();
        vipResume.setId(22L);
        vipResume.setTitle("产品经理");

        ResumeModule basicInfo = module(31L, 21L, "basic_info", Map.of(
                "name", "不应公开的姓名",
                "jobIntention", "Agent 工程师",
                "workYears", "3年",
                "targetCity", "北京"
        ));
        ResumeModule education = module(32L, 21L, "education", Map.of(
                "school", "北京邮电大学",
                "degree", "硕士",
                "major", "计算机科学"
        ));
        ResumeModule skill = module(33L, 21L, "skill", Map.of(
                "categories", List.of(Map.of("items", List.of(
                        "熟悉 Java 并发编程",
                        "掌握 Spring Boot",
                        "不应进入公开缩略图的第三条技能"
                )))
        ));
        ResumeModule work = module(34L, 21L, "work_experience", Map.of(
                "company", "字节跳动",
                "position", "软件工程师",
                "projects", List.of(Map.of(
                        "projectName", "AI Agent 信用评分系统",
                        "projectDescription", "这是一段只用于缩略图预览并且必须在服务端进行长度限制的项目简介，不能通过公开列表接口返回完整正文内容。"
                ))
        ));

        when(resumeShowcaseMapper.selectList(any())).thenReturn(List.of(freeShowcase, vipShowcase));
        when(resumeMapper.selectBatchIds(any())).thenReturn(List.of(freeResume, vipResume));
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(basicInfo, education, skill, work));

        var cards = resumeShowcaseService.listPublishedShowcases();

        assertEquals(2, cards.size());
        assertEquals("excellent-java", cards.get(0).getSlug());
        assertEquals("excellent-product", cards.get(1).getSlug());
        assertEquals("warm", cards.get(0).getTemplateId());
        assertEquals("continuous", cards.get(0).getPageMode());
        assertEquals("compact", cards.get(0).getDensity());
        assertEquals("warm", cards.get(0).getAccentPreset());
        assertEquals("filled", cards.get(0).getHeadingStyle());
        assertEquals("", cards.get(0).getPreview().getName());
        assertEquals("Agent 工程师 · 3年 · 北京", cards.get(0).getPreview().getBasicInfo());
        assertEquals(List.of("北京邮电大学 · 硕士 · 计算机科学"), cards.get(0).getPreview().getEducations());
        assertEquals(List.of("熟悉 Java 并发编程", "掌握 Spring Boot"), cards.get(0).getPreview().getSkills());
        assertEquals("字节跳动 · 软件工程师", cards.get(0).getPreview().getExperiences().get(0));
        assertEquals("AI Agent 信用评分系统", cards.get(0).getPreview().getProjects().get(0).getTitle());
        assertTrue(cards.get(0).getPreview().getProjects().get(0).getDescription().endsWith("…"));
        assertEquals(49, cards.get(0).getPreview().getProjects().get(0).getDescription().length());
        verifyNoInteractions(membershipService);
    }

    @Test
    void publicUserCanViewFreeShowcaseDetail() {
        ResumeShowcase showcase = showcase("FREE");
        Resume resume = resume();
        resume.setPageMode("continuous");
        resume.setPdfDensity("compact");
        resume.setAccentPreset("warm");
        resume.setHeadingStyle("filled");
        ResumeModule module = module();
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase);
        when(resumeMapper.selectById(21L)).thenReturn(resume);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));

        var detail = resumeShowcaseService.getPublicPublishedDetail("excellent-java");

        assertEquals(11L, detail.getId());
        assertEquals("Java 后端开发", detail.getTitle());
        assertEquals("continuous", detail.getPageMode());
        assertEquals("classic-blue", detail.getTemplateId());
        assertEquals("compact", detail.getDensity());
        assertEquals("warm", detail.getAccentPreset());
        assertEquals("filled", detail.getHeadingStyle());
        assertSame(module, detail.getModules().get(0));
        verifyNoInteractions(membershipService);
    }

    @Test
    void publicUserCannotViewVipShowcaseDetail() {
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase("VIP"));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.getPublicPublishedDetail("excellent-java")
        );

        assertEquals(ResultCode.SHOWCASE_MEMBERSHIP_REQUIRED.getCode(), exception.getCode());
        verifyNoInteractions(resumeMapper, resumeModuleMapper, membershipService);
    }

    @Test
    void legacyShowcaseWithoutAccessTypeDefaultsToVip() {
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase(null));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.getPublicPublishedDetail("excellent-java")
        );

        assertEquals(ResultCode.SHOWCASE_MEMBERSHIP_REQUIRED.getCode(), exception.getCode());
        verifyNoInteractions(resumeMapper, resumeModuleMapper, membershipService);
    }

    @Test
    void authenticatedFreeUserCanViewFreeShowcaseWithoutMembershipCheck() {
        ResumeShowcase showcase = showcase("FREE");
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase);
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module()));

        var detail = resumeShowcaseService.getPublishedDetail("excellent-java", 7L);

        assertEquals(11L, detail.getId());
        verifyNoInteractions(membershipService);
    }

    @Test
    void authenticatedFreeUserCannotViewVipShowcaseDetail() {
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase("VIP"));
        when(membershipService.isActiveMember(7L)).thenReturn(false);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.getPublishedDetail("excellent-java", 7L)
        );

        assertEquals(ResultCode.SHOWCASE_MEMBERSHIP_REQUIRED.getCode(), exception.getCode());
        verifyNoInteractions(resumeMapper, resumeModuleMapper);
    }

    @Test
    void activeUserCanViewVipShowcaseDetail() {
        ResumeShowcase showcase = showcase("VIP");
        Resume resume = resume();
        ResumeModule module = module();

        when(membershipService.isActiveMember(7L)).thenReturn(true);
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase);
        when(resumeMapper.selectById(21L)).thenReturn(resume);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));

        var detail = resumeShowcaseService.getPublishedDetail("excellent-java", 7L);

        assertEquals(11L, detail.getId());
        assertEquals("Java 后端开发", detail.getTitle());
        assertEquals("classic-blue", detail.getTemplateId());
        assertSame(module, detail.getModules().get(0));
        verify(membershipService).isActiveMember(7L);
    }

    @Test
    void showcaseDetailRemovesPersonalBasicInfo() {
        ResumeModule basicInfo = new ResumeModule();
        basicInfo.setId(32L);
        basicInfo.setResumeId(21L);
        basicInfo.setModuleType("basic_info");
        basicInfo.setContent(Map.of(
                "name", "张三",
                "email", "zhangsan@example.com",
                "phone", "13800138000",
                "photo", "data:image/png;base64,AAAA",
                "jobIntention", "Java 后端"
        ));
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase("FREE"));
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(basicInfo));

        var detail = resumeShowcaseService.getPublicPublishedDetail("excellent-java");

        assertEquals(Map.of("jobIntention", "Java 后端"), detail.getModules().get(0).getContent());
    }

    @Test
    void creatingShowcaseNormalizesAccessType() {
        ResumeShowcaseUpsertDTO dto = showcaseUpsert(" free ");
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(null);

        ResumeShowcase created = resumeShowcaseService.create(7L, dto);

        assertEquals("FREE", created.getAccessType());
        verify(resumeShowcaseMapper).insert(created);
    }

    @Test
    void creatingShowcaseRejectsUnsupportedAccessType() {
        ResumeShowcaseUpsertDTO dto = showcaseUpsert("PAID");
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(null);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.create(7L, dto)
        );

        assertEquals(ResultCode.BAD_REQUEST.getCode(), exception.getCode());
        assertEquals("访问类型只能是 FREE 或 VIP", exception.getMessage());
        verify(resumeShowcaseMapper, never()).insert(any(ResumeShowcase.class));
    }

    @Test
    void featuringResumeGeneratesMetadataAndPublishesNewRecord() {
        Resume resume = resume();
        ResumeModule module = module();
        ShowcaseMetadataDTO metadata = metadata();
        when(resumeMapper.selectById(21L)).thenReturn(resume);
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(null);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));
        when(aiService.generateShowcaseMetadata(resume.getTitle(), List.of(module))).thenReturn(metadata);
        when(resumeShowcaseMapper.selectCount(null)).thenReturn(2L);

        ResumeShowcase featured = resumeShowcaseService.featureResume(21L, 7L, "VIP");

        assertEquals("featured-21", featured.getSlug());
        assertEquals("Java 后端", featured.getScoreLabel());
        assertEquals("包含 Java 项目与后端工程实践", featured.getSummary());
        assertEquals(List.of("Java", "Spring Boot"), featured.getTags());
        assertEquals("VIP", featured.getAccessType());
        assertEquals("PUBLISHED", featured.getPublishStatus());
        assertEquals(2, featured.getDisplayOrder());
        verify(resumeShowcaseMapper).insert(featured);
    }

    @Test
    void featuringPublishedResumeIsIdempotent() {
        ResumeShowcase published = showcase("VIP");
        published.setPublishStatus("PUBLISHED");
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(published);

        ResumeShowcase result = resumeShowcaseService.featureResume(21L, 7L, "VIP");

        assertSame(published, result);
        verifyNoInteractions(aiService, resumeModuleMapper);
        verify(resumeShowcaseMapper, never()).insert(any(ResumeShowcase.class));
        verify(resumeShowcaseMapper, never()).updateById(any(ResumeShowcase.class));
    }

    @Test
    void featuringPublishedResumeCanChangeAccessTypeWithoutRegeneratingMetadata() {
        ResumeShowcase published = showcase("VIP");
        published.setPublishStatus("PUBLISHED");
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(published);

        ResumeShowcase result = resumeShowcaseService.featureResume(21L, 7L, " free ");

        assertSame(published, result);
        assertEquals("FREE", result.getAccessType());
        verify(resumeShowcaseMapper).updateById(published);
        verifyNoInteractions(aiService, resumeModuleMapper);
    }

    @Test
    void featuringEmptyResumeDoesNotCreateShowcase() {
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(null);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of());

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.featureResume(21L, 7L, "VIP")
        );

        assertEquals("简历内容为空，无法精选", exception.getMessage());
        verifyNoInteractions(aiService);
        verify(resumeShowcaseMapper, never()).insert(any(ResumeShowcase.class));
    }

    @Test
    void featuringResumeWithOnlyBasicInfoDoesNotCallAi() {
        ResumeModule basicInfo = new ResumeModule();
        basicInfo.setModuleType("basic_info");
        basicInfo.setContent(Map.of("name", "张三"));
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(null);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(basicInfo));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.featureResume(21L, 7L, "VIP")
        );

        assertEquals("简历内容为空，无法精选", exception.getMessage());
        verifyNoInteractions(aiService);
    }

    @Test
    void featuringResumeRejectsContentChangedDuringAiGeneration() {
        Resume original = resume();
        original.setUpdatedAt(LocalDateTime.of(2026, 8, 10, 10, 0));
        Resume changed = resume();
        changed.setUpdatedAt(LocalDateTime.of(2026, 8, 10, 10, 1));
        ResumeModule module = module();
        when(resumeMapper.selectById(21L)).thenReturn(original, changed);
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(null);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));
        when(aiService.generateShowcaseMetadata(original.getTitle(), List.of(module)))
                .thenReturn(metadata());

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.featureResume(21L, 7L, "VIP")
        );

        assertEquals("简历内容已更新，请重新精选", exception.getMessage());
        verify(resumeShowcaseMapper, never()).insert(any(ResumeShowcase.class));
        verify(resumeShowcaseMapper, never()).updateById(any(ResumeShowcase.class));
    }

    @Test
    void concurrentFeatureReturnsExistingShowcaseInsteadOfDatabaseError() {
        Resume resume = resume();
        ResumeModule module = module();
        ResumeShowcase concurrent = showcase("VIP");
        concurrent.setPublishStatus("PUBLISHED");
        when(resumeMapper.selectById(21L)).thenReturn(resume);
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(null, null, concurrent);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));
        when(aiService.generateShowcaseMetadata(resume.getTitle(), List.of(module)))
                .thenReturn(metadata());
        when(resumeShowcaseMapper.selectCount(null)).thenReturn(0L);
        when(resumeShowcaseMapper.insert(any(ResumeShowcase.class)))
                .thenThrow(new DuplicateKeyException("duplicate"));

        ResumeShowcase result = resumeShowcaseService.featureResume(21L, 7L, "VIP");

        assertSame(concurrent, result);
    }

    @Test
    void aiFailureDoesNotLeaveHalfCreatedShowcase() {
        Resume resume = resume();
        ResumeModule module = module();
        when(resumeMapper.selectById(21L)).thenReturn(resume);
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(null);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));
        when(aiService.generateShowcaseMetadata(resume.getTitle(), List.of(module)))
                .thenThrow(new BusinessException(ResultCode.AI_SERVICE_BUSY));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> resumeShowcaseService.featureResume(21L, 7L, "VIP")
        );

        assertEquals(ResultCode.AI_SERVICE_BUSY.getCode(), exception.getCode());
        verify(resumeShowcaseMapper, never()).insert(any(ResumeShowcase.class));
        verify(resumeShowcaseMapper, never()).updateById(any(ResumeShowcase.class));
    }

    @Test
    void unfeaturingResumeKeepsMetadataAndMovesRecordToDraft() {
        ResumeShowcase published = showcase("VIP");
        published.setPublishStatus("PUBLISHED");
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(published);

        ResumeShowcase result = resumeShowcaseService.unfeatureResume(21L, 7L);

        assertSame(published, result);
        assertEquals("DRAFT", result.getPublishStatus());
        assertEquals("后端开发优质简历", result.getSummary());
        verify(resumeShowcaseMapper).updateById(published);
        verifyNoInteractions(aiService);
    }

    @Test
    void deletingSourceResumeMovesPublishedShowcaseBackToDraft() {
        ResumeShowcase showcase = new ResumeShowcase();
        showcase.setId(11L);
        showcase.setResumeId(21L);
        showcase.setPublishStatus("PUBLISHED");
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase);

        resumeShowcaseService.unpublishDeletedResume(21L);

        assertEquals("DRAFT", showcase.getPublishStatus());
        verify(resumeShowcaseMapper).updateById(showcase);
    }

    @Test
    void deletingResumeWithoutPublishedShowcaseDoesNotWrite() {
        ResumeShowcase showcase = new ResumeShowcase();
        showcase.setId(11L);
        showcase.setResumeId(21L);
        showcase.setPublishStatus("DRAFT");
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase);

        resumeShowcaseService.unpublishDeletedResume(21L);

        verify(resumeShowcaseMapper, never()).updateById(any(ResumeShowcase.class));
    }

    private ResumeShowcase showcase(String accessType) {
        ResumeShowcase showcase = new ResumeShowcase();
        showcase.setId(11L);
        showcase.setResumeId(21L);
        showcase.setSlug("excellent-java");
        showcase.setScoreLabel("优质");
        showcase.setSummary("后端开发优质简历");
        showcase.setTags(List.of("Java", "AI"));
        showcase.setAccessType(accessType);
        return showcase;
    }

    private Resume resume() {
        Resume resume = new Resume();
        resume.setId(21L);
        resume.setUserId(7L);
        resume.setStatus(1);
        resume.setTitle("Java 后端开发");
        resume.setTemplateId("classic-blue");
        return resume;
    }

    private ResumeModule module() {
        ResumeModule module = new ResumeModule();
        module.setId(31L);
        module.setResumeId(21L);
        module.setModuleType("project");
        module.setContent(Map.of("description", "负责 Java 服务端与 AI 应用开发"));
        return module;
    }

    private ResumeModule module(Long id, Long resumeId, String moduleType, Map<String, Object> content) {
        ResumeModule module = new ResumeModule();
        module.setId(id);
        module.setResumeId(resumeId);
        module.setModuleType(moduleType);
        module.setContent(content);
        return module;
    }

    private ResumeShowcaseUpsertDTO showcaseUpsert(String accessType) {
        ResumeShowcaseUpsertDTO dto = new ResumeShowcaseUpsertDTO();
        dto.setResumeId(21L);
        dto.setSlug("excellent-java");
        dto.setScoreLabel("优质");
        dto.setSummary("后端开发优质简历");
        dto.setTags(List.of("Java", "AI"));
        dto.setDisplayOrder(1);
        dto.setPublishStatus("PUBLISHED");
        dto.setAccessType(accessType);
        return dto;
    }

    private ShowcaseMetadataDTO metadata() {
        ShowcaseMetadataDTO metadata = new ShowcaseMetadataDTO();
        metadata.setDisplayLabel("Java 后端");
        metadata.setSummary("包含 Java 项目与后端工程实践");
        metadata.setTags(List.of("Java", "Spring Boot"));
        return metadata;
    }
}
