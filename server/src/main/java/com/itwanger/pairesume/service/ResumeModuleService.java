package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.ModuleCreateDTO;
import com.itwanger.pairesume.dto.ModuleUpdateDTO;
import com.itwanger.pairesume.entity.ResumeModule;

import java.util.List;

public interface ResumeModuleService {
    List<ResumeModule> listByResumeId(Long resumeId, Long userId);
    ResumeModule create(Long resumeId, Long userId, ModuleCreateDTO dto);
    ResumeModule update(Long resumeId, Long userId, Long moduleId, ModuleUpdateDTO dto);
    void reorder(Long resumeId, Long userId, List<Long> moduleIds);
    void delete(Long resumeId, Long userId, Long moduleId);
}
