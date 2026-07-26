package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.dto.ModuleCreateDTO;
import com.itwanger.pairesume.dto.ResumeCreateDTO;
import com.itwanger.pairesume.dto.ResumeImportDTO;
import com.itwanger.pairesume.service.ResumeImportService;
import com.itwanger.pairesume.service.ResumeModuleService;
import com.itwanger.pairesume.service.ResumeService;
import com.itwanger.pairesume.vo.ResumeListVO;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ResumeImportServiceImpl implements ResumeImportService {
    private final ResumeService resumeService;
    private final ResumeModuleService resumeModuleService;

    public ResumeImportServiceImpl(
            ResumeService resumeService,
            ResumeModuleService resumeModuleService
    ) {
        this.resumeService = resumeService;
        this.resumeModuleService = resumeModuleService;
    }

    @Override
    @Transactional
    public ResumeListVO importResume(Long userId, ResumeImportDTO dto) {
        ResumeCreateDTO resumeCreateDTO = new ResumeCreateDTO();
        resumeCreateDTO.setTitle(normalizeOptional(dto.getTitle()));
        resumeCreateDTO.setTemplateId(normalizeOptional(dto.getTemplateId()));
        ResumeListVO resume = resumeService.create(userId, resumeCreateDTO);

        for (int index = 0; index < dto.getModules().size(); index++) {
            var importedModule = dto.getModules().get(index);
            ModuleCreateDTO moduleCreateDTO = new ModuleCreateDTO();
            moduleCreateDTO.setModuleType(importedModule.getModuleType().trim());
            moduleCreateDTO.setContent(importedModule.getContent());
            moduleCreateDTO.setSortOrder(
                    importedModule.getSortOrder() != null ? importedModule.getSortOrder() : index
            );
            resumeModuleService.create(resume.getId(), userId, moduleCreateDTO);
        }

        return resume;
    }

    private String normalizeOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
