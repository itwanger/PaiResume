package com.itwanger.pairesume.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.service.MembershipService;
import com.itwanger.pairesume.service.ResumeModuleService;
import com.itwanger.pairesume.service.ResumeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResumeExportServiceImplTest {
    @Mock private ResumeService resumeService;
    @Mock private ResumeModuleService resumeModuleService;
    @Mock private MembershipService membershipService;

    private ResumeExportServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ResumeExportServiceImpl(
                resumeService,
                resumeModuleService,
                membershipService,
                new ObjectMapper()
        );
    }

    @Test
    void legacyRemotePhotoIsRejectedBeforePdfWorkerStarts() {
        Resume resume = new Resume();
        resume.setId(11L);
        resume.setUserId(7L);
        resume.setTitle("测试简历");
        ResumeModule basicInfo = new ResumeModule();
        basicInfo.setResumeId(11L);
        basicInfo.setModuleType("basic_info");
        basicInfo.setContent(Map.of("photo", "http://127.0.0.1:8080/internal.png"));

        when(membershipService.isActiveMember(7L)).thenReturn(true);
        when(resumeService.getByIdAndUserId(11L, 7L)).thenReturn(resume);
        when(resumeModuleService.listByResumeId(11L, 7L)).thenReturn(List.of(basicInfo));

        assertThrows(BusinessException.class, () -> service.exportPdf(11L, 7L, null));
    }
}
