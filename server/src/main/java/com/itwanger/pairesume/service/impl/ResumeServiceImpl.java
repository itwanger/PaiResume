package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.ResumeCreateDTO;
import com.itwanger.pairesume.dto.ResumeUpdateDTO;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.service.ResumeMarketplaceService;
import com.itwanger.pairesume.service.ResumeService;
import com.itwanger.pairesume.service.ResumeShowcaseService;
import com.itwanger.pairesume.vo.ResumeListVO;
import com.itwanger.pairesume.vo.ResumeCardPreviewVO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ResumeServiceImpl implements ResumeService {

    private final ResumeMapper resumeMapper;
    private final ResumeModuleMapper resumeModuleMapper;
    private final ResumeMarketplaceService resumeMarketplaceService;
    private final ResumeShowcaseService resumeShowcaseService;

    @Value("${resume.max-count-per-user:20}")
    private int maxResumeCountPerUser;

    public ResumeServiceImpl(
            ResumeMapper resumeMapper,
            ResumeModuleMapper resumeModuleMapper,
            ResumeMarketplaceService resumeMarketplaceService,
            ResumeShowcaseService resumeShowcaseService
    ) {
        this.resumeMapper = resumeMapper;
        this.resumeModuleMapper = resumeModuleMapper;
        this.resumeMarketplaceService = resumeMarketplaceService;
        this.resumeShowcaseService = resumeShowcaseService;
    }

    @Override
    public List<ResumeListVO> listByUserId(Long userId) {
        var resumes = resumeMapper.selectList(
            new LambdaQueryWrapper<Resume>()
                .eq(Resume::getUserId, userId)
                .eq(Resume::getStatus, 1)
                .orderByDesc(Resume::getUpdatedAt)
        );

        if (resumes.isEmpty()) return List.of();

        var resumeIds = resumes.stream().map(Resume::getId).toList();
        var modulesByResumeId = resumeModuleMapper.selectList(
                        new LambdaQueryWrapper<ResumeModule>()
                                .in(ResumeModule::getResumeId, resumeIds)
                                .orderByAsc(ResumeModule::getSortOrder)
                                .orderByAsc(ResumeModule::getId))
                .stream()
                .collect(Collectors.groupingBy(ResumeModule::getResumeId, LinkedHashMap::new, Collectors.toList()));

        return resumes.stream().map(r -> {
            var vo = new ResumeListVO();
            vo.setId(r.getId());
            vo.setTitle(r.getTitle());
            vo.setTemplateId(r.getTemplateId());
            vo.setPreview(buildCardPreview(modulesByResumeId.getOrDefault(r.getId(), List.of())));
            vo.setCreatedAt(r.getCreatedAt());
            vo.setUpdatedAt(r.getUpdatedAt());
            return vo;
        }).toList();
    }

    private ResumeCardPreviewVO buildCardPreview(List<ResumeModule> modules) {
        var preview = new ResumeCardPreviewVO();
        var meaningfulModules = modules.stream()
                .filter(module -> hasMeaningfulValue(module.getContent()))
                .toList();
        preview.setFilledModuleCount(meaningfulModules.size());
        preview.setModuleCounts(meaningfulModules.stream().collect(Collectors.toMap(
                ResumeModule::getModuleType,
                ignored -> 1,
                Integer::sum,
                LinkedHashMap::new)));

        var basicInfo = firstContent(modules, "basic_info");
        var jobIntention = firstContent(modules, "job_intention");
        preview.setName(text(basicInfo, "name"));
        preview.setTargetRole(firstText(
                text(basicInfo, "jobIntention"),
                text(jobIntention, "targetPosition"),
                firstModuleText(modules, List.of("work_experience", "internship"), "position")));

        var education = firstContent(modules, "education");
        preview.setEducation(joinSummary(text(education, "school"), text(education, "major")));

        var experience = firstModuleContent(modules, List.of("work_experience", "internship"));
        preview.setExperience(joinSummary(
                firstText(text(experience, "company"), text(experience, "projectName")),
                text(experience, "position")));

        var project = firstContent(modules, "project");
        preview.setProject(joinSummary(text(project, "projectName"), text(project, "role")));
        preview.setSkills(extractSkills(modules));
        return preview;
    }

    private List<String> extractSkills(List<ResumeModule> modules) {
        var result = new LinkedHashSet<String>();
        var skill = firstContent(modules, "skill");
        Object categories = skill.get("categories");
        if (categories instanceof Collection<?> collection) {
            for (Object rawCategory : collection) {
                if (!(rawCategory instanceof Map<?, ?> category)) continue;
                addStrings(result, category.get("items"));
                if (result.size() >= 6) break;
            }
        }
        if (result.isEmpty()) {
            modules.stream()
                    .filter(module -> Set.of("project", "work_experience", "internship").contains(module.getModuleType()))
                    .map(ResumeModule::getContent)
                    .filter(Objects::nonNull)
                    .map(content -> text(content, "techStack"))
                    .filter(value -> !value.isBlank())
                    .flatMap(value -> Arrays.stream(value.split("[,，、/|\\s]+")))
                    .map(String::strip)
                    .filter(value -> !value.isBlank())
                    .forEach(result::add);
        }
        return result.stream().limit(6).toList();
    }

    private void addStrings(Set<String> target, Object value) {
        if (!(value instanceof Collection<?> collection)) return;
        collection.stream()
                .filter(String.class::isInstance)
                .map(String.class::cast)
                .map(String::strip)
                .filter(item -> !item.isBlank())
                .limit(6)
                .forEach(target::add);
    }

    private Map<String, Object> firstContent(List<ResumeModule> modules, String moduleType) {
        return modules.stream()
                .filter(module -> moduleType.equals(module.getModuleType()))
                .map(ResumeModule::getContent)
                .filter(Objects::nonNull)
                .filter(this::hasMeaningfulValue)
                .findFirst()
                .orElseGet(Map::of);
    }

    private Map<String, Object> firstModuleContent(List<ResumeModule> modules, List<String> moduleTypes) {
        for (String moduleType : moduleTypes) {
            var content = firstContent(modules, moduleType);
            if (!content.isEmpty()) return content;
        }
        return Map.of();
    }

    private String firstModuleText(List<ResumeModule> modules, List<String> moduleTypes, String field) {
        return text(firstModuleContent(modules, moduleTypes), field);
    }

    private boolean hasMeaningfulValue(Object value) {
        if (value == null) return false;
        if (value instanceof String string) return !string.isBlank();
        if (value instanceof Boolean bool) return bool;
        if (value instanceof Number number) return number.doubleValue() != 0;
        if (value instanceof Map<?, ?> map) return map.values().stream().anyMatch(this::hasMeaningfulValue);
        if (value instanceof Collection<?> collection) return collection.stream().anyMatch(this::hasMeaningfulValue);
        return false;
    }

    private String text(Map<String, Object> content, String field) {
        Object value = content.get(field);
        return value instanceof String string ? string.strip() : "";
    }

    private String firstText(String... values) {
        return Arrays.stream(values).filter(value -> value != null && !value.isBlank()).findFirst().orElse("");
    }

    private String joinSummary(String primary, String secondary) {
        return Arrays.stream(new String[]{primary, secondary})
                .filter(value -> value != null && !value.isBlank())
                .collect(Collectors.joining(" · "));
    }

    @Override
    public ResumeListVO create(Long userId, ResumeCreateDTO dto) {
        var title = normalizeRequiredTitle(dto.getTitle());

        // 检查简历数量上限
        var count = resumeMapper.selectCount(
            new LambdaQueryWrapper<Resume>()
                .eq(Resume::getUserId, userId)
                .eq(Resume::getStatus, 1)
        );
        if (count >= maxResumeCountPerUser) {
            throw new BusinessException(ResultCode.RESUME_LIMIT_REACHED);
        }

        var resume = new Resume();
        resume.setUserId(userId);
        resume.setTitle(title);
        resume.setTemplateId(dto.getTemplateId() != null ? dto.getTemplateId() : "default");
        resume.setStatus(1);
        resumeMapper.insert(resume);

        var vo = new ResumeListVO();
        vo.setId(resume.getId());
        vo.setTitle(resume.getTitle());
        vo.setTemplateId(resume.getTemplateId());
        vo.setPreview(new ResumeCardPreviewVO());
        vo.setCreatedAt(resume.getCreatedAt());
        vo.setUpdatedAt(resume.getUpdatedAt());
        return vo;
    }

    private String normalizeRequiredTitle(String title) {
        if (title == null || title.isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请输入简历名称");
        }

        var normalizedTitle = title.strip();
        if (normalizedTitle.length() > 128) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "简历名称不能超过 128 个字符");
        }

        return normalizedTitle;
    }

    @Override
    @Transactional
    public ResumeListVO update(Long userId, Long resumeId, ResumeUpdateDTO dto) {
        var resume = getAndVerifyOwnership(resumeId, userId);
        resume.setTitle(dto.getTitle().strip());
        resumeMapper.updateById(resume);
        resumeShowcaseService.unpublishChangedResume(resumeId);
        return toListVO(resume);
    }

    @Override
    @Transactional
    public void delete(Long userId, Long resumeId) {
        getAndVerifyOwnership(resumeId, userId);
        if (resumeMapper.deleteById(resumeId) != 1) {
            throw new BusinessException(ResultCode.RESUME_NOT_FOUND);
        }
        resumeMarketplaceService.unpublishDeletedResume(resumeId, userId);
        resumeShowcaseService.unpublishDeletedResume(resumeId);
    }

    @Override
    public Resume getByIdAndUserId(Long resumeId, Long userId) {
        return getAndVerifyOwnership(resumeId, userId);
    }

    private ResumeListVO toListVO(Resume resume) {
        var vo = new ResumeListVO();
        vo.setId(resume.getId());
        vo.setTitle(resume.getTitle());
        vo.setTemplateId(resume.getTemplateId());
        vo.setPreview(new ResumeCardPreviewVO());
        vo.setCreatedAt(resume.getCreatedAt());
        vo.setUpdatedAt(resume.getUpdatedAt());
        return vo;
    }

    private Resume getAndVerifyOwnership(Long resumeId, Long userId) {
        var resume = resumeMapper.selectById(resumeId);
        if (resume == null || !resume.getUserId().equals(userId) || resume.getStatus() == 0) {
            throw new BusinessException(ResultCode.RESUME_NOT_FOUND);
        }
        return resume;
    }
}
