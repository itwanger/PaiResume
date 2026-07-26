package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.service.ResumeMarketplaceService;
import com.itwanger.pairesume.service.ResumeShowcaseService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResumeServiceImplTest {
    @Mock private ResumeMapper resumeMapper;
    @Mock private ResumeMarketplaceService resumeMarketplaceService;
    @Mock private ResumeShowcaseService resumeShowcaseService;

    private ResumeServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ResumeServiceImpl(
                resumeMapper,
                resumeMarketplaceService,
                resumeShowcaseService
        );
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
