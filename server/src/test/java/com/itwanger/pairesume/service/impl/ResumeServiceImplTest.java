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
                "major", "计算机科学与技术"));
        ResumeModule project = module(11L, "project", Map.of(
                "projectName", "派聪明 RAG",
                "role", "核心开发"));
        ResumeModule skill = module(11L, "skill", Map.of(
                "categories", List.of(Map.of("name", "后端", "items", List.of("Java", "Spring Boot", "MySQL")))));
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(basic, education, project, skill));

        var result = service.listByUserId(7L);

        assertEquals(1, result.size());
        assertEquals("张天霸", result.get(0).getPreview().getName());
        assertEquals("Agent 工程师", result.get(0).getPreview().getTargetRole());
        assertEquals("郑州大学 · 计算机科学与技术", result.get(0).getPreview().getEducation());
        assertEquals("派聪明 RAG · 核心开发", result.get(0).getPreview().getProject());
        assertEquals(List.of("Java", "Spring Boot", "MySQL"), result.get(0).getPreview().getSkills());
        assertEquals(4, result.get(0).getPreview().getFilledModuleCount());
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
    void renamingResumeUnpublishesFeaturedVersion() {
        Resume resume = new Resume();
        resume.setId(11L);
        resume.setUserId(7L);
        resume.setStatus(1);
        when(resumeMapper.selectById(11L)).thenReturn(resume);
        ResumeUpdateDTO dto = new ResumeUpdateDTO();
        dto.setTitle("AI 应用开发简历");

        service.update(7L, 11L, dto);

        verify(resumeMapper).updateById(resume);
        verify(resumeShowcaseService).unpublishChangedResume(11L);
    }

    @Test
    void updatingStylePersistsResumeOwnedPdfConfiguration() {
        Resume resume = new Resume();
        resume.setId(11L);
        resume.setUserId(7L);
        resume.setStatus(1);
        when(resumeMapper.selectById(11L)).thenReturn(resume);
        ResumeStyleUpdateDTO dto = new ResumeStyleUpdateDTO();
        dto.setTemplateId("warm");
        dto.setDensity("compact");
        dto.setAccentPreset("warm");
        dto.setHeadingStyle("filled");

        var result = service.updateStyle(7L, 11L, dto);

        assertEquals("warm", resume.getTemplateId());
        assertEquals("compact", resume.getPdfDensity());
        assertEquals("warm", resume.getAccentPreset());
        assertEquals("filled", resume.getHeadingStyle());
        assertEquals("warm", result.getTemplateId());
        assertEquals("compact", result.getDensity());
        assertEquals("warm", result.getAccentPreset());
        assertEquals("filled", result.getHeadingStyle());
        verify(resumeMapper).updateById(resume);
        verify(resumeShowcaseService).unpublishChangedResume(11L);
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
