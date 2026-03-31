package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.ModuleCreateDTO;
import com.itwanger.pairesume.dto.ModuleUpdateDTO;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.service.ResumeModuleService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.List;

@Service
public class ResumeModuleServiceImpl implements ResumeModuleService {
    private static final Set<String> SINGLETON_MODULE_TYPES = Set.of("basic_info", "skill", "job_intention");

    private final ResumeModuleMapper moduleMapper;
    private final ResumeMapper resumeMapper;

    public ResumeModuleServiceImpl(ResumeModuleMapper moduleMapper, ResumeMapper resumeMapper) {
        this.moduleMapper = moduleMapper;
        this.resumeMapper = resumeMapper;
    }

    @Override
    public List<ResumeModule> listByResumeId(Long resumeId, Long userId) {
        verifyResumeOwnership(resumeId, userId);
        return moduleMapper.selectList(
            new LambdaQueryWrapper<ResumeModule>()
                .eq(ResumeModule::getResumeId, resumeId)
                .orderByAsc(ResumeModule::getSortOrder)
                .orderByAsc(ResumeModule::getId)
        );
    }

    @Override
    public ResumeModule create(Long resumeId, Long userId, ModuleCreateDTO dto) {
        verifyResumeOwnership(resumeId, userId);
        validateSingletonModule(resumeId, dto.getModuleType());

        var module = new ResumeModule();
        module.setResumeId(resumeId);
        module.setModuleType(dto.getModuleType());
        module.setContent(dto.getContent());
        module.setSortOrder(dto.getSortOrder() != null ? dto.getSortOrder() : getNextSortOrder(resumeId));
        moduleMapper.insert(module);
        touchResume(resumeId);
        return module;
    }

    @Override
    public ResumeModule update(Long resumeId, Long userId, Long moduleId, ModuleUpdateDTO dto) {
        verifyResumeOwnership(resumeId, userId);

        var module = moduleMapper.selectById(moduleId);
        if (module == null || !module.getResumeId().equals(resumeId)) {
            throw new BusinessException(ResultCode.MODULE_NOT_FOUND);
        }

        module.setContent(dto.getContent());
        moduleMapper.updateById(module);
        touchResume(resumeId);
        return module;
    }

    @Override
    public void delete(Long resumeId, Long userId, Long moduleId) {
        verifyResumeOwnership(resumeId, userId);

        var module = moduleMapper.selectById(moduleId);
        if (module == null || !module.getResumeId().equals(resumeId)) {
            throw new BusinessException(ResultCode.MODULE_NOT_FOUND);
        }
        moduleMapper.deleteById(moduleId);
        touchResume(resumeId);
    }

    private void verifyResumeOwnership(Long resumeId, Long userId) {
        var resume = resumeMapper.selectById(resumeId);
        if (resume == null || !resume.getUserId().equals(userId) || resume.getStatus() == 0) {
            throw new BusinessException(ResultCode.RESUME_NOT_FOUND);
        }
    }

    private void validateSingletonModule(Long resumeId, String moduleType) {
        if (!SINGLETON_MODULE_TYPES.contains(moduleType)) {
            return;
        }

        var existingCount = moduleMapper.selectCount(
            new LambdaQueryWrapper<ResumeModule>()
                .eq(ResumeModule::getResumeId, resumeId)
                .eq(ResumeModule::getModuleType, moduleType)
        );

        if (existingCount != null && existingCount > 0) {
            throw new BusinessException(ResultCode.MODULE_ALREADY_EXISTS);
        }
    }

    private int getNextSortOrder(Long resumeId) {
        var latestModule = moduleMapper.selectOne(
            new LambdaQueryWrapper<ResumeModule>()
                .eq(ResumeModule::getResumeId, resumeId)
                .orderByDesc(ResumeModule::getSortOrder)
                .orderByDesc(ResumeModule::getId)
                .last("LIMIT 1")
        );

        if (latestModule == null || latestModule.getSortOrder() == null) {
            return 1;
        }

        return latestModule.getSortOrder() + 1;
    }

    private void touchResume(Long resumeId) {
        var resume = new Resume();
        resume.setId(resumeId);
        resume.setUpdatedAt(LocalDateTime.now());
        resumeMapper.updateById(resume);
    }
}
