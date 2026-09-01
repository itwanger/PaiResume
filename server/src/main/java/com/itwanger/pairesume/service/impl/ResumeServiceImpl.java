package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.ResumeCreateDTO;
import com.itwanger.pairesume.dto.ResumeStyleUpdateDTO;
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
import com.itwanger.pairesume.vo.ResumeCardProjectPreviewVO;
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
            applyStyle(r, vo);
            vo.setPreview(buildCardPreview(modulesByResumeId.getOrDefault(r.getId(), List.of())));
            vo.setCreatedAt(r.getCreatedAt());
            vo.setUpdatedAt(r.getUpdatedAt());
            return vo;
        }).toList();
    }

    static ResumeCardPreviewVO buildCardPreview(List<ResumeModule> modules) {
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
        preview.setModuleOrder(meaningfulModules.stream()
                .map(ResumeModule::getModuleType)
                .distinct()
                .toList());

        var basicInfo = firstContent(modules, "basic_info");
        var jobIntention = firstContent(modules, "job_intention");
        preview.setName(text(basicInfo, "name"));
        preview.setTargetRole(firstText(
                text(basicInfo, "jobIntention"),
                text(jobIntention, "targetPosition"),
                firstModuleText(modules, List.of("work_experience", "internship"), "position")));
        preview.setBasicInfo(joinSummary(
                preview.getTargetRole(),
                text(basicInfo, "workYears"),
                firstText(text(basicInfo, "targetCity"), text(jobIntention, "targetCity"))));

        var educations = extractEducationSummaries(modules);
        preview.setEducations(educations);
        preview.setEducation(educations.stream().findFirst().orElse(""));

        var experiences = extractExperienceSummaries(modules);
        preview.setExperiences(experiences);
        preview.setExperience(experiences.stream().findFirst().orElse(""));
        preview.setWorkExperiences(extractExperienceSummaries(modules, Set.of("work_experience")));
        preview.setInternships(extractExperienceSummaries(modules, Set.of("internship")));

        var projects = extractProjectPreviews(modules);
        preview.setProjects(projects);
        preview.setProject(projects.stream().findFirst().map(ResumeCardProjectPreviewVO::getTitle).orElse(""));
        preview.setSkills(extractSkills(modules));
        return preview;
    }

    private static List<String> extractEducationSummaries(List<ResumeModule> modules) {
        return modules.stream()
                .filter(module -> "education".equals(module.getModuleType()))
                .map(ResumeModule::getContent)
                .filter(Objects::nonNull)
                .filter(ResumeServiceImpl::hasMeaningfulValue)
                .map(content -> joinSummary(
                        text(content, "school"),
                        text(content, "degree"),
                        text(content, "major")))
                .filter(summary -> !summary.isBlank())
                .limit(2)
                .toList();
    }

    private static List<String> extractExperienceSummaries(List<ResumeModule> modules) {
        return extractExperienceSummaries(modules, Set.of("work_experience", "internship"));
    }

    private static List<String> extractExperienceSummaries(List<ResumeModule> modules, Set<String> moduleTypes) {
        var groups = new ArrayList<List<String>>();
        for (ResumeModule module : modules) {
            if (!moduleTypes.contains(module.getModuleType())) continue;
            var content = module.getContent();
            if (content == null || !hasMeaningfulValue(content)) continue;
            var summaries = extractExperienceResponsibilityLines(content);
            if (!summaries.isEmpty()) groups.add(summaries);
        }
        return takeFirstAcrossGroups(groups, 2);
    }

    private static List<String> extractExperienceResponsibilityLines(Map<String, Object> content) {
        var primary = new ArrayList<String>();
        var additional = new ArrayList<String>();
        Object rawProjects = content.get("projects");
        if (rawProjects instanceof Collection<?> projects) {
            for (Object rawProject : projects) {
                if (!(rawProject instanceof Map<?, ?> project)) continue;
                addResponsibilityLines(
                        primary,
                        additional,
                        getStringValues(project.get("responsibilities")),
                        firstText(getMapText(project, "projectDescription"), getMapText(project, "techStack")));
            }
        }
        if (primary.isEmpty()) {
            addResponsibilityLines(
                    primary,
                    additional,
                    getStringValues(content.get("responsibilities")),
                    firstText(text(content, "projectDescription"), text(content, "techStack")));
        }
        primary.addAll(additional);
        return primary;
    }

    private static void addResponsibilityLines(
            List<String> primary,
            List<String> additional,
            List<String> responsibilities,
            String fallback
    ) {
        var details = responsibilities.isEmpty()
                ? fallback.isBlank() ? List.<String>of() : List.of(fallback)
                : responsibilities;
        if (details.isEmpty()) return;
        primary.add(details.get(0));
        details.stream().skip(1).forEach(additional::add);
    }

    private static List<String> takeFirstAcrossGroups(List<List<String>> groups, int limit) {
        var result = new ArrayList<String>();
        int offset = 0;
        while (result.size() < limit) {
            boolean found = false;
            for (List<String> group : groups) {
                if (offset >= group.size()) continue;
                String value = group.get(offset);
                if (!value.isBlank()) result.add(value);
                found = true;
                if (result.size() >= limit) break;
            }
            if (!found) break;
            offset++;
        }
        return result;
    }

    private static List<ResumeCardProjectPreviewVO> extractProjectPreviews(List<ResumeModule> modules) {
        var groups = new ArrayList<List<ResumeCardProjectPreviewVO>>();
        for (ResumeModule module : modules) {
            if (!"project".equals(module.getModuleType())) continue;
            var content = module.getContent();
            if (content == null || !hasMeaningfulValue(content)) continue;
            String title = joinSummary(text(content, "projectName"), text(content, "role"));
            List<String> responsibilities = getStringValues(content.get("achievements"));
            if (responsibilities.isEmpty()) {
                String fallback = firstText(text(content, "description"), text(content, "techStack"));
                responsibilities = fallback.isBlank() ? List.of() : List.of(fallback);
            }
            List<ResumeCardProjectPreviewVO> previews = responsibilities.stream()
                    .map(responsibility -> new ResumeCardProjectPreviewVO(title, responsibility))
                    .toList();
            if (!previews.isEmpty()) groups.add(previews);
        }
        return takeFirstProjectsAcrossGroups(groups, 2);
    }

    private static List<ResumeCardProjectPreviewVO> takeFirstProjectsAcrossGroups(
            List<List<ResumeCardProjectPreviewVO>> groups,
            int limit
    ) {
        var result = new ArrayList<ResumeCardProjectPreviewVO>();
        int offset = 0;
        while (result.size() < limit) {
            boolean found = false;
            for (List<ResumeCardProjectPreviewVO> group : groups) {
                if (offset >= group.size()) continue;
                result.add(group.get(offset));
                found = true;
                if (result.size() >= limit) break;
            }
            if (!found) break;
            offset++;
        }
        return result;
    }

    private static String getMapText(Map<?, ?> content, String field) {
        Object value = content.get(field);
        return value instanceof String string ? string.strip() : "";
    }

    private static List<String> getStringValues(Object value) {
        if (value instanceof Collection<?> collection) {
            return collection.stream()
                    .filter(String.class::isInstance)
                    .map(String.class::cast)
                    .map(ResumeServiceImpl::normalizeResponsibilityLine)
                    .filter(item -> !item.isBlank())
                    .toList();
        }
        if (value instanceof String string) {
            return Arrays.stream(string.split("\\R+"))
                    .map(ResumeServiceImpl::normalizeResponsibilityLine)
                    .filter(line -> !line.isBlank())
                    .toList();
        }
        return List.of();
    }

    private static String normalizeResponsibilityLine(String value) {
        String normalized = value.replaceFirst("^[\\s*+\\-•·]+", "").strip();
        if (normalized.matches("^(项目简介|核心职责)[:：]?$")) return "";
        if (normalized.startsWith("项目简介：") || normalized.startsWith("项目简介:")) return "";
        return normalized.replaceFirst("^核心职责[:：]\\s*", "").strip();
    }

    private static List<String> extractSkills(List<ResumeModule> modules) {
        var result = new LinkedHashSet<String>();
        var skill = firstContent(modules, "skill");
        Object categories = skill.get("categories");
        if (categories instanceof Collection<?> collection) {
            for (Object rawCategory : collection) {
                if (!(rawCategory instanceof Map<?, ?> category)) continue;
                addStrings(result, category.get("items"));
                if (result.size() >= 8) break;
            }
        }
        for (ResumeModule module : modules) {
            if (result.size() >= 8) break;
            if (!Set.of("project", "work_experience", "internship").contains(module.getModuleType())) continue;
            var content = module.getContent();
            if (content == null) continue;
            addTechStackSkills(result, text(content, "techStack"));
            Object rawProjects = content.get("projects");
            if (rawProjects instanceof Collection<?> projects) {
                for (Object rawProject : projects) {
                    if (!(rawProject instanceof Map<?, ?> project)) continue;
                    addTechStackSkills(result, getMapText(project, "techStack"));
                    if (result.size() >= 8) break;
                }
            }
        }
        return result.stream().limit(8).toList();
    }

    private static void addTechStackSkills(LinkedHashSet<String> target, String techStack) {
        if (techStack == null || techStack.isBlank()) return;
        Arrays.stream(techStack.split("[,，、/|;；]+"))
                .map(String::strip)
                .filter(value -> !value.isBlank())
                .filter(value -> target.stream().noneMatch(existing ->
                        existing.toLowerCase(Locale.ROOT).contains(value.toLowerCase(Locale.ROOT))))
                .forEach(target::add);
    }

    private static void addStrings(Set<String> target, Object value) {
        if (!(value instanceof Collection<?> collection)) return;
        collection.stream()
                .filter(String.class::isInstance)
                .map(String.class::cast)
                .map(String::strip)
                .filter(item -> !item.isBlank())
                .forEach(target::add);
    }

    private static Map<String, Object> firstContent(List<ResumeModule> modules, String moduleType) {
        return modules.stream()
                .filter(module -> moduleType.equals(module.getModuleType()))
                .map(ResumeModule::getContent)
                .filter(Objects::nonNull)
                .filter(ResumeServiceImpl::hasMeaningfulValue)
                .findFirst()
                .orElseGet(Map::of);
    }

    private static Map<String, Object> firstModuleContent(List<ResumeModule> modules, List<String> moduleTypes) {
        for (String moduleType : moduleTypes) {
            var content = firstContent(modules, moduleType);
            if (!content.isEmpty()) return content;
        }
        return Map.of();
    }

    private static String firstModuleText(List<ResumeModule> modules, List<String> moduleTypes, String field) {
        return text(firstModuleContent(modules, moduleTypes), field);
    }

    private static boolean hasMeaningfulValue(Object value) {
        if (value == null) return false;
        if (value instanceof String string) return !string.isBlank();
        if (value instanceof Boolean bool) return bool;
        if (value instanceof Number number) return number.doubleValue() != 0;
        if (value instanceof Map<?, ?> map) return map.entrySet().stream()
                .filter(entry -> !"id".equals(String.valueOf(entry.getKey())))
                .anyMatch(entry -> hasMeaningfulValue(entry.getValue()));
        if (value instanceof Collection<?> collection) return collection.stream().anyMatch(ResumeServiceImpl::hasMeaningfulValue);
        return false;
    }

    private static String text(Map<String, Object> content, String field) {
        Object value = content.get(field);
        return value instanceof String string ? string.strip() : "";
    }

    private static String firstText(String... values) {
        return Arrays.stream(values).filter(value -> value != null && !value.isBlank()).findFirst().orElse("");
    }

    private static String joinSummary(String... values) {
        return Arrays.stream(values)
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
        resume.setPdfDensity("normal");
        resume.setAccentPreset("auto");
        resume.setHeadingStyle("auto");
        resume.setStatus(1);
        resumeMapper.insert(resume);

        var vo = new ResumeListVO();
        vo.setId(resume.getId());
        vo.setTitle(resume.getTitle());
        applyStyle(resume, vo);
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
        return toListVO(resume);
    }

    @Override
    @Transactional
    public ResumeListVO updateStyle(Long userId, Long resumeId, ResumeStyleUpdateDTO dto) {
        var resume = getAndVerifyOwnership(resumeId, userId);
        resume.setPageMode(dto.getPageMode());
        resume.setTemplateId(dto.getTemplateId());
        resume.setPdfDensity(dto.getDensity());
        resume.setAccentPreset(dto.getAccentPreset());
        resume.setHeadingStyle(dto.getHeadingStyle());
        resumeMapper.updateById(resume);
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
        applyStyle(resume, vo);
        var modules = resumeModuleMapper.selectList(
                new LambdaQueryWrapper<ResumeModule>()
                        .eq(ResumeModule::getResumeId, resume.getId())
                        .orderByAsc(ResumeModule::getSortOrder)
                        .orderByAsc(ResumeModule::getId));
        vo.setPreview(buildCardPreview(modules));
        vo.setCreatedAt(resume.getCreatedAt());
        vo.setUpdatedAt(resume.getUpdatedAt());
        return vo;
    }

    private void applyStyle(Resume resume, ResumeListVO vo) {
        vo.setPageMode(defaultIfBlank(resume.getPageMode(), "standard"));
        vo.setTemplateId(defaultIfBlank(resume.getTemplateId(), "default"));
        vo.setDensity(defaultIfBlank(resume.getPdfDensity(), "normal"));
        vo.setAccentPreset(defaultIfBlank(resume.getAccentPreset(), "auto"));
        vo.setHeadingStyle(defaultIfBlank(resume.getHeadingStyle(), "auto"));
    }

    private String defaultIfBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private Resume getAndVerifyOwnership(Long resumeId, Long userId) {
        var resume = resumeMapper.selectById(resumeId);
        if (resume == null || !resume.getUserId().equals(userId) || resume.getStatus() == 0) {
            throw new BusinessException(ResultCode.RESUME_NOT_FOUND);
        }
        return resume;
    }
}
