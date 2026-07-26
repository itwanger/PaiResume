package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.dto.ModuleCreateDTO;
import com.itwanger.pairesume.dto.ResumeCreateDTO;
import com.itwanger.pairesume.dto.ResumeImportDTO;
import com.itwanger.pairesume.dto.ResumeImportModuleDTO;
import com.itwanger.pairesume.service.ResumeModuleService;
import com.itwanger.pairesume.service.ResumeService;
import com.itwanger.pairesume.vo.ResumeListVO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResumeImportServiceImplTest {
    @Mock private ResumeService resumeService;
    @Mock private ResumeModuleService resumeModuleService;

    private ResumeImportServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ResumeImportServiceImpl(resumeService, resumeModuleService);
    }

    @Test
    void importsResumeAndAllModulesInOneOrderedOperation() {
        ResumeListVO createdResume = new ResumeListVO();
        createdResume.setId(31L);
        when(resumeService.create(eq(7L), any(ResumeCreateDTO.class))).thenReturn(createdResume);

        ResumeImportDTO dto = importDto(
                module("basic_info", Map.of("name", "张三"), null),
                module("project", Map.of("projectName", "派简历"), 9)
        );

        ResumeListVO result = service.importResume(7L, dto);

        assertSame(createdResume, result);
        ArgumentCaptor<ResumeCreateDTO> resumeCaptor = ArgumentCaptor.forClass(ResumeCreateDTO.class);
        verify(resumeService).create(eq(7L), resumeCaptor.capture());
        assertEquals("导入简历", resumeCaptor.getValue().getTitle());
        assertEquals("classic-blue", resumeCaptor.getValue().getTemplateId());

        ArgumentCaptor<ModuleCreateDTO> moduleCaptor = ArgumentCaptor.forClass(ModuleCreateDTO.class);
        verify(resumeModuleService, times(2))
                .create(eq(31L), eq(7L), moduleCaptor.capture());
        assertEquals("basic_info", moduleCaptor.getAllValues().get(0).getModuleType());
        assertEquals(0, moduleCaptor.getAllValues().get(0).getSortOrder());
        assertEquals("project", moduleCaptor.getAllValues().get(1).getModuleType());
        assertEquals(9, moduleCaptor.getAllValues().get(1).getSortOrder());

        InOrder order = inOrder(resumeService, resumeModuleService);
        order.verify(resumeService).create(eq(7L), any(ResumeCreateDTO.class));
        order.verify(resumeModuleService, times(2))
                .create(eq(31L), eq(7L), any(ModuleCreateDTO.class));
    }

    @Test
    void moduleFailureEscapesTransactionAndStopsRemainingWrites() {
        ResumeListVO createdResume = new ResumeListVO();
        createdResume.setId(31L);
        when(resumeService.create(eq(7L), any(ResumeCreateDTO.class))).thenReturn(createdResume);
        when(resumeModuleService.create(eq(31L), eq(7L), any(ModuleCreateDTO.class)))
                .thenThrow(new IllegalStateException("module insert failed"));

        ResumeImportDTO dto = importDto(
                module("basic_info", Map.of("name", "张三"), 0),
                module("project", Map.of("projectName", "不应写入"), 1)
        );

        assertThrows(IllegalStateException.class, () -> service.importResume(7L, dto));

        verify(resumeModuleService).create(eq(31L), eq(7L), any(ModuleCreateDTO.class));
        verify(resumeModuleService, never()).delete(31L, 7L, 1L);
    }

    @Test
    void importMethodDeclaresTransactionBoundary() throws NoSuchMethodException {
        var method = ResumeImportServiceImpl.class.getMethod(
                "importResume",
                Long.class,
                ResumeImportDTO.class
        );

        assertTrue(AnnotatedElementUtils.hasAnnotation(method, Transactional.class));
    }

    private ResumeImportDTO importDto(ResumeImportModuleDTO... modules) {
        ResumeImportDTO dto = new ResumeImportDTO();
        dto.setTitle("  导入简历  ");
        dto.setTemplateId(" classic-blue ");
        dto.setModules(List.of(modules));
        return dto;
    }

    private ResumeImportModuleDTO module(
            String moduleType,
            Map<String, Object> content,
            Integer sortOrder
    ) {
        ResumeImportModuleDTO dto = new ResumeImportModuleDTO();
        dto.setModuleType(moduleType);
        dto.setContent(content);
        dto.setSortOrder(sortOrder);
        return dto;
    }
}
