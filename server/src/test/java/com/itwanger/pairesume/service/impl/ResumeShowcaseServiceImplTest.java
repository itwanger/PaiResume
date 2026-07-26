package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.ResumeShowcaseUpsertDTO;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.entity.ResumeShowcase;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.mapper.ResumeShowcaseMapper;
import com.itwanger.pairesume.service.MembershipService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
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

    private ResumeShowcaseServiceImpl resumeShowcaseService;

    @BeforeEach
    void setUp() {
        resumeShowcaseService = new ResumeShowcaseServiceImpl(
                resumeShowcaseMapper,
                resumeMapper,
                resumeModuleMapper,
                membershipService
        );
    }

    @Test
    void publicListIncludesFreeAndVipShowcaseCards() {
        ResumeShowcase freeShowcase = showcase("FREE");
        ResumeShowcase vipShowcase = showcase("VIP");
        vipShowcase.setId(12L);
        vipShowcase.setResumeId(22L);
        vipShowcase.setSlug("excellent-product");

        Resume vipResume = resume();
        vipResume.setId(22L);
        vipResume.setTitle("产品经理");

        when(resumeShowcaseMapper.selectList(any())).thenReturn(List.of(freeShowcase, vipShowcase));
        when(resumeMapper.selectById(21L)).thenReturn(resume());
        when(resumeMapper.selectById(22L)).thenReturn(vipResume);

        var cards = resumeShowcaseService.listPublishedShowcases();

        assertEquals(2, cards.size());
        assertEquals("excellent-java", cards.get(0).getSlug());
        assertEquals("excellent-product", cards.get(1).getSlug());
        verifyNoInteractions(membershipService);
    }

    @Test
    void publicUserCanViewFreeShowcaseDetail() {
        ResumeShowcase showcase = showcase("FREE");
        Resume resume = resume();
        ResumeModule module = module();
        when(resumeShowcaseMapper.selectOne(any())).thenReturn(showcase);
        when(resumeMapper.selectById(21L)).thenReturn(resume);
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(module));

        var detail = resumeShowcaseService.getPublicPublishedDetail("excellent-java");

        assertEquals(11L, detail.getId());
        assertEquals("Java 后端开发", detail.getTitle());
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
}
