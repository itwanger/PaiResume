package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.dto.ModuleCreateDTO;
import com.itwanger.pairesume.dto.ModuleUpdateDTO;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResumeModuleServiceImplTest {
    @Mock private ResumeModuleMapper moduleMapper;
    @Mock private ResumeMapper resumeMapper;

    private ResumeModuleServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ResumeModuleServiceImpl(moduleMapper, resumeMapper);
        Resume resume = new Resume();
        resume.setId(11L);
        resume.setUserId(7L);
        resume.setStatus(1);
        when(resumeMapper.selectById(11L)).thenReturn(resume);
    }

    @Test
    void createRejectsRemotePhotoBeforePersistence() {
        ModuleCreateDTO dto = new ModuleCreateDTO();
        dto.setModuleType("basic_info");
        dto.setContent(Map.of("photo", "http://127.0.0.1:8080/internal.png"));
        when(moduleMapper.selectCount(any())).thenReturn(0L);

        assertThrows(BusinessException.class, () -> service.create(11L, 7L, dto));

        verify(moduleMapper, never()).insert(any(ResumeModule.class));
    }

    @Test
    void updateRejectsAbsolutePhotoPathBeforePersistence() {
        ResumeModule module = new ResumeModule();
        module.setId(19L);
        module.setResumeId(11L);
        module.setModuleType("basic_info");
        when(moduleMapper.selectById(19L)).thenReturn(module);
        ModuleUpdateDTO dto = new ModuleUpdateDTO();
        dto.setContent(Map.of("photo", "/etc/private-image.png"));

        assertThrows(BusinessException.class, () -> service.update(11L, 7L, 19L, dto));

        verify(moduleMapper, never()).updateById(any(ResumeModule.class));
    }

    @Test
    void updatingModuleKeepsFeaturedResumePublished() {
        ResumeModule module = new ResumeModule();
        module.setId(19L);
        module.setResumeId(11L);
        module.setModuleType("project");
        when(moduleMapper.selectById(19L)).thenReturn(module);
        ModuleUpdateDTO dto = new ModuleUpdateDTO();
        dto.setContent(Map.of("description", "更新后的项目经历"));

        service.update(11L, 7L, 19L, dto);

        verify(moduleMapper).updateById(module);
    }

    @Test
    void reorderPersistsTheCompleteModuleOrderAtomically() {
        ResumeModule basicInfo = module(1L, "basic_info", 0);
        ResumeModule education = module(2L, "education", 1);
        ResumeModule project = module(3L, "project", 2);
        when(moduleMapper.selectList(any())).thenReturn(List.of(basicInfo, education, project));

        service.reorder(11L, 7L, List.of(1L, 3L, 2L));

        verify(moduleMapper).updateSortOrder(11L, 1L, 0);
        verify(moduleMapper).updateSortOrder(11L, 3L, 1);
        verify(moduleMapper).updateSortOrder(11L, 2L, 2);
    }

    @Test
    void reorderRejectsMissingOrDuplicateModuleIds() {
        when(moduleMapper.selectList(any())).thenReturn(List.of(
                module(1L, "basic_info", 0),
                module(2L, "education", 1),
                module(3L, "project", 2)
        ));

        assertThrows(BusinessException.class, () -> service.reorder(11L, 7L, List.of(1L, 1L, 3L)));

        verify(moduleMapper, never()).updateSortOrder(any(), any(), any());
    }

    private ResumeModule module(Long id, String moduleType, int sortOrder) {
        ResumeModule module = new ResumeModule();
        module.setId(id);
        module.setResumeId(11L);
        module.setModuleType(moduleType);
        module.setSortOrder(sortOrder);
        module.setContent(Map.of());
        return module;
    }
}
