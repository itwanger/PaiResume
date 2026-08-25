package com.itwanger.pairesume.controller;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.itwanger.pairesume.dto.SmartOnePagePreviewRequestDTO;
import com.itwanger.pairesume.dto.SmartOnePagePreviewResponseDTO;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.service.AiService;
import com.itwanger.pairesume.service.MembershipService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SmartOnePageControllerTest {

    private static final long USER_ID = 51L;
    private static final long RESUME_ID = 7L;

    @Mock
    private AiService aiService;
    @Mock
    private ResumeMapper resumeMapper;
    @Mock
    private ResumeModuleMapper moduleMapper;
    @Mock
    private MembershipService membershipService;

    private SmartOnePageController controller;

    @BeforeEach
    void setUp() {
        controller = new SmartOnePageController(aiService, resumeMapper, moduleMapper, membershipService);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(USER_ID, null, List.of())
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void layoutOnlyPreviewDoesNotRequireMembership() {
        var request = request("layout_only");
        var expected = arrangePreview(request);

        var result = controller.preview(RESUME_ID, request);

        assertSame(expected, result.getData());
        verify(membershipService, never()).requireAiAccess(USER_ID);
    }

    @Test
    void optimizeAndLayoutPreviewStillRequiresAiAccess() {
        var request = request("optimize_and_layout");
        var expected = arrangePreview(request);

        var result = controller.preview(RESUME_ID, request);

        assertSame(expected, result.getData());
        verify(membershipService).requireAiAccess(USER_ID);
    }

    private SmartOnePagePreviewResponseDTO arrangePreview(SmartOnePagePreviewRequestDTO request) {
        var resume = new Resume();
        resume.setId(RESUME_ID);
        resume.setUserId(USER_ID);
        resume.setTitle("求职简历");
        resume.setStatus(1);

        var module = new ResumeModule();
        module.setId(11L);
        module.setResumeId(RESUME_ID);
        module.setModuleType("basic_info");

        var expected = new SmartOnePagePreviewResponseDTO();
        when(resumeMapper.selectById(RESUME_ID)).thenReturn(resume);
        when(moduleMapper.selectList(any(Wrapper.class))).thenReturn(List.of(module));
        when(aiService.previewSmartOnePage(eq(resume.getTitle()), eq(List.of(module)), eq(request)))
                .thenReturn(expected);
        return expected;
    }

    private SmartOnePagePreviewRequestDTO request(String mode) {
        var request = new SmartOnePagePreviewRequestDTO();
        request.setMode(mode);
        request.setPromptMode("skill");
        request.setSkillId("concise");
        request.setTemplateId("technical");
        request.setAdoptionPolicy("only_if_better");
        request.setOutputFormat("continuous_pdf");
        return request;
    }
}
