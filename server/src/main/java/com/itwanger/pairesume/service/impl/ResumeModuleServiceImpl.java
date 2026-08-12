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
import com.itwanger.pairesume.security.ResumePhotoSecurityPolicy;
import com.itwanger.pairesume.service.ResumeModuleService;
import com.itwanger.pairesume.service.ResumeShowcaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.List;

@Service
public class ResumeModuleServiceImpl implements ResumeModuleService {
    private static final Set<String> SINGLETON_MODULE_TYPES = Set.of("basic_info", "skill", "job_intention");

    private final ResumeModuleMapper moduleMapper;
    private final ResumeMapper resumeMapper;
    private final ResumeShowcaseService resumeShowcaseService;
    private final ResumePhotoService resumePhotoService;

    @Autowired
    public ResumeModuleServiceImpl(
            ResumeModuleMapper moduleMapper,
            ResumeMapper resumeMapper,
            ResumeShowcaseService resumeShowcaseService,
            ResumePhotoService resumePhotoService
    ) {
        this.moduleMapper = moduleMapper;
        this.resumeMapper = resumeMapper;
        this.resumeShowcaseService = resumeShowcaseService;
        this.resumePhotoService = resumePhotoService;
    }

    public ResumeModuleServiceImpl(ResumeModuleMapper moduleMapper, ResumeMapper resumeMapper,
                                   ResumeShowcaseService resumeShowcaseService) {
        this(moduleMapper, resumeMapper, resumeShowcaseService, null);
    }

    @Override
    public List<ResumeModule> listByResumeId(Long resumeId, Long userId) {
        verifyResumeOwnership(resumeId, userId);
        return moduleMapper.selectList(
            new LambdaQueryWrapper<ResumeModule>()
                .eq(ResumeModule::getResumeId, resumeId)
                .orderByAsc(ResumeModule::getSortOrder)
                .orderByAsc(ResumeModule::getId)
        ).stream().map(module -> hydrateForRead(module, userId)).toList();
    }

    @Override
    @Transactional
    public ResumeModule create(Long resumeId, Long userId, ModuleCreateDTO dto) {
        verifyResumeOwnership(resumeId, userId);
        validateSingletonModule(resumeId, dto.getModuleType());
        var module = new ResumeModule();
        module.setResumeId(resumeId);
        module.setModuleType(dto.getModuleType());
        module.setContent(prepareForPersistence(userId, dto.getModuleType(), dto.getContent()));
        module.setSortOrder(dto.getSortOrder() != null ? dto.getSortOrder() : getNextSortOrder(resumeId));
        moduleMapper.insert(module);
        touchResume(resumeId);
        resumeShowcaseService.unpublishChangedResume(resumeId);
        return hydrateForRead(module, userId);
    }

    @Override
    @Transactional
    public ResumeModule update(Long resumeId, Long userId, Long moduleId, ModuleUpdateDTO dto) {
        verifyResumeOwnership(resumeId, userId);

        var module = moduleMapper.selectById(moduleId);
        if (module == null || !module.getResumeId().equals(resumeId)) {
            throw new BusinessException(ResultCode.MODULE_NOT_FOUND);
        }

        module.setContent(prepareForPersistence(userId, module.getModuleType(), dto.getContent()));
        moduleMapper.updateById(module);
        touchResume(resumeId);
        resumeShowcaseService.unpublishChangedResume(resumeId);
        return hydrateForRead(module, userId);
    }

    @Override
    @Transactional
    public void delete(Long resumeId, Long userId, Long moduleId) {
        verifyResumeOwnership(resumeId, userId);

        var module = moduleMapper.selectById(moduleId);
        if (module == null || !module.getResumeId().equals(resumeId)) {
            throw new BusinessException(ResultCode.MODULE_NOT_FOUND);
        }
        moduleMapper.deleteById(moduleId);
        touchResume(resumeId);
        resumeShowcaseService.unpublishChangedResume(resumeId);
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

    private java.util.Map<String, Object> prepareForPersistence(Long userId, String moduleType,
                                                                 java.util.Map<String, Object> content) {
        if (resumePhotoService == null) {
            ResumePhotoSecurityPolicy.validateModuleContent(moduleType, content);
            return content;
        }
        return resumePhotoService.prepareBasicInfoForPersistence(userId, moduleType, content);
    }

    private ResumeModule hydrateForRead(ResumeModule module, Long userId) {
        if (resumePhotoService != null && module != null) {
            module.setContent(resumePhotoService.hydrateBasicInfoForRead(
                    userId, module.getModuleType(), module.getContent()));
        }
        return module;
    }
}
