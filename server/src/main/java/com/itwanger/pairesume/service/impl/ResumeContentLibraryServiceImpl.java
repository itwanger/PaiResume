package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.*;
import com.itwanger.pairesume.entity.*;
import com.itwanger.pairesume.mapper.*;
import com.itwanger.pairesume.security.ResumePhotoSecurityPolicy;
import com.itwanger.pairesume.service.AiService;
import com.itwanger.pairesume.service.ResumeContentLibraryService;
import com.itwanger.pairesume.service.ResumeImportService;
import com.itwanger.pairesume.vo.ResumeListVO;
import com.itwanger.pairesume.vo.ResumeHistoryMaterialVO;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.*;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ResumeContentLibraryServiceImpl implements ResumeContentLibraryService {
    private static final Set<String> MODULE_TYPES = Set.of(
            "basic_info", "education", "internship", "work_experience", "project",
            "skill", "paper", "research", "award", "job_intention"
    );
    private static final Set<String> OFFICIAL_STATUSES = Set.of("DRAFT", "PUBLISHED", "ARCHIVED");
    private static final Set<String> PROFILE_FIELDS = Set.of(
            "name", "email", "jobIntention", "targetCity", "salaryRange", "expectedEntryDate",
            "phone", "wechat", "isPartyMember", "photo", "photoId", "photoBorder", "hometown", "blog",
            "github", "leetcode", "workYears", "summary"
    );
    private static final int MAX_CONTENT_CHARACTERS = 40_000;
    private static final int MAX_PROFILE_CHARACTERS = 4_500_000;
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^\\d{7,15}$");

    private final UserResumeProfileMapper profileMapper;
    private final UserResumeMaterialMapper userMaterialMapper;
    private final ResumeMapper resumeMapper;
    private final ResumeModuleMapper resumeModuleMapper;
    private final OfficialResumeMaterialMapper officialMaterialMapper;
    private final ResumeContentTemplateMapper contentTemplateMapper;
    private final ResumeImportService resumeImportService;
    private final AiService aiService;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    @Autowired(required = false)
    private ResumePhotoService resumePhotoService;

    @Override
    public UserResumeProfile getProfile(Long userId) {
        UserResumeProfile profile = profileMapper.selectById(userId);
        if (profile != null) {
            if (resumePhotoService != null) {
                profile.setContent(resumePhotoService.hydrateBasicInfoForRead(
                        userId, "basic_info", profile.getContent()));
            }
            return profile;
        }
        profile = new UserResumeProfile();
        profile.setUserId(userId);
        profile.setContent(Map.of());
        return profile;
    }

    @Override
    @Transactional
    public UserResumeProfile saveProfile(Long userId, ResumeProfileUpdateDTO dto) {
        Map<String, Object> content = sanitizeProfile(dto.getContent());
        if (resumePhotoService != null) {
            content = resumePhotoService.prepareBasicInfoForPersistence(userId, "basic_info", content);
        }
        validateProfileFields(content);
        ResumePhotoSecurityPolicy.validateModuleContent("basic_info", content);
        validateContent(content, MAX_PROFILE_CHARACTERS);
        UserResumeProfile profile = profileMapper.selectById(userId);
        if (profile == null) {
            profile = new UserResumeProfile();
            profile.setUserId(userId);
            profile.setContent(content);
            profileMapper.insert(profile);
        } else {
            profile.setContent(content);
            profileMapper.updateById(profile);
        }
        if (resumePhotoService != null) {
            profile.setContent(resumePhotoService.hydrateBasicInfoForRead(
                    userId, "basic_info", profile.getContent()));
        }
        return profile;
    }

    @Override
    public List<UserResumeMaterial> listUserMaterials(Long userId, String moduleType, String query) {
        var wrapper = new LambdaQueryWrapper<UserResumeMaterial>()
                .eq(UserResumeMaterial::getUserId, userId)
                .eq(UserResumeMaterial::getStatus, "ACTIVE");
        if (hasText(moduleType)) wrapper.eq(UserResumeMaterial::getModuleType, normalizeModuleType(moduleType));
        if (hasText(query)) wrapper.like(UserResumeMaterial::getTitle, query.strip());
        return userMaterialMapper.selectList(wrapper
                .orderByDesc(UserResumeMaterial::getUpdatedAt)
                .orderByDesc(UserResumeMaterial::getId));
    }

    @Override
    public UserResumeMaterial createUserMaterial(Long userId, ResumeMaterialUpsertDTO dto) {
        UserResumeMaterial material = new UserResumeMaterial();
        material.setUserId(userId);
        applyUserMaterial(material, dto);
        userMaterialMapper.insert(material);
        return material;
    }

    @Override
    public UserResumeMaterial updateUserMaterial(Long userId, Long materialId, ResumeMaterialUpsertDTO dto) {
        UserResumeMaterial material = requireOwnedMaterial(userId, materialId);
        applyUserMaterial(material, dto);
        userMaterialMapper.updateById(material);
        return material;
    }

    @Override
    public void deleteUserMaterial(Long userId, Long materialId) {
        userMaterialMapper.deleteById(requireOwnedMaterial(userId, materialId));
    }

    @Override
    public List<ResumeHistoryMaterialVO> listHistoryMaterials(Long userId, String moduleType,
                                                              String query, Long excludeResumeId) {
        String normalizedType = hasText(moduleType) ? normalizeModuleType(moduleType) : null;
        String keyword = normalizeOptional(query).toLowerCase(Locale.ROOT);

        var resumeWrapper = new LambdaQueryWrapper<Resume>()
                .eq(Resume::getUserId, userId)
                .eq(Resume::getStatus, 1);
        if (excludeResumeId != null) resumeWrapper.ne(Resume::getId, excludeResumeId);
        List<Resume> resumes = resumeMapper.selectList(resumeWrapper
                .orderByDesc(Resume::getUpdatedAt)
                .orderByDesc(Resume::getId));

        Map<Long, Resume> resumeById = new LinkedHashMap<>();
        resumes.forEach(resume -> resumeById.put(resume.getId(), resume));
        List<ResumeModule> modules = List.of();
        if (!resumeById.isEmpty()) {
            var moduleWrapper = new LambdaQueryWrapper<ResumeModule>()
                    .in(ResumeModule::getResumeId, resumeById.keySet());
            if (normalizedType != null) moduleWrapper.eq(ResumeModule::getModuleType, normalizedType);
            modules = resumeModuleMapper.selectList(moduleWrapper
                    .orderByDesc(ResumeModule::getUpdatedAt)
                    .orderByDesc(ResumeModule::getId));
        }

        LinkedHashMap<String, ResumeHistoryMaterialVO> deduplicated = new LinkedHashMap<>();
        for (ResumeModule module : modules) {
            Map<String, Object> content = copyMap(module.getContent());
            if (!isReusableHistoryContent(module.getModuleType(), content)) continue;
            if ("basic_info".equals(module.getModuleType()) && resumePhotoService != null) {
                content = resumePhotoService.hydrateBasicInfoForRead(userId, "basic_info", content);
            }
            String title = historyMaterialTitle(module.getModuleType(), content);
            if (!matchesHistoryQuery(keyword, title, content)) continue;
            String identity = historyMaterialIdentity(module.getModuleType(), content);
            Resume sourceResume = resumeById.get(module.getResumeId());
            deduplicated.putIfAbsent(identity, ResumeHistoryMaterialVO.builder()
                    .key("resume-module-" + module.getId())
                    .moduleType(module.getModuleType())
                    .title(title)
                    .content(content)
                    .sourceType("HISTORY_RESUME")
                    .sourceResumeId(module.getResumeId())
                    .sourceResumeTitle(sourceResume == null ? "" : sourceResume.getTitle())
                    .updatedAt(module.getUpdatedAt())
                    .build());
        }

        if (normalizedType == null || "basic_info".equals(normalizedType)) {
            UserResumeProfile legacyProfile = profileMapper.selectById(userId);
            if (legacyProfile != null && isReusableHistoryContent("basic_info", legacyProfile.getContent())) {
                Map<String, Object> content = copyMap(legacyProfile.getContent());
                if (resumePhotoService != null) {
                    content = resumePhotoService.hydrateBasicInfoForRead(userId, "basic_info", content);
                }
                String title = historyMaterialTitle("basic_info", content);
                if (matchesHistoryQuery(keyword, title, content)) {
                    String identity = historyMaterialIdentity("basic_info", content);
                    deduplicated.putIfAbsent(identity, ResumeHistoryMaterialVO.builder()
                            .key("legacy-profile-" + userId)
                            .moduleType("basic_info")
                            .title(title)
                            .content(content)
                            .sourceType("LEGACY_PROFILE")
                            .updatedAt(legacyProfile.getUpdatedAt())
                            .build());
                }
            }
        }

        var legacyWrapper = new LambdaQueryWrapper<UserResumeMaterial>()
                .eq(UserResumeMaterial::getUserId, userId)
                .eq(UserResumeMaterial::getStatus, "ACTIVE");
        if (normalizedType != null) legacyWrapper.eq(UserResumeMaterial::getModuleType, normalizedType);
        List<UserResumeMaterial> legacyMaterials = userMaterialMapper.selectList(legacyWrapper
                .orderByDesc(UserResumeMaterial::getUpdatedAt)
                .orderByDesc(UserResumeMaterial::getId));
        for (UserResumeMaterial material : legacyMaterials) {
            if (!isReusableHistoryContent(material.getModuleType(), material.getContent())) continue;
            if (!matchesHistoryQuery(keyword, material.getTitle(), material.getContent())) continue;
            String identity = historyMaterialIdentity(material.getModuleType(), material.getContent());
            deduplicated.putIfAbsent(identity, ResumeHistoryMaterialVO.builder()
                    .key("legacy-material-" + material.getId())
                    .moduleType(material.getModuleType())
                    .title(material.getTitle())
                    .content(copyMap(material.getContent()))
                    .sourceType("LEGACY_LIBRARY")
                    .legacyMaterialId(material.getId())
                    .updatedAt(material.getUpdatedAt())
                    .build());
        }
        return List.copyOf(deduplicated.values());
    }

    @Override
    public List<OfficialResumeMaterial> listPublishedMaterials(String moduleType, String query, String targetRole) {
        var wrapper = new LambdaQueryWrapper<OfficialResumeMaterial>()
                .eq(OfficialResumeMaterial::getStatus, "PUBLISHED");
        if (hasText(moduleType)) wrapper.eq(OfficialResumeMaterial::getModuleType, normalizeModuleType(moduleType));
        if (hasText(targetRole)) wrapper.like(OfficialResumeMaterial::getTargetRole, targetRole.strip());
        if (hasText(query)) {
            String keyword = query.strip();
            wrapper.and(item -> item.like(OfficialResumeMaterial::getTitle, keyword)
                    .or().like(OfficialResumeMaterial::getTargetRole, keyword));
        }
        return officialMaterialMapper.selectList(wrapper
                .orderByDesc(OfficialResumeMaterial::getUseCount)
                .orderByDesc(OfficialResumeMaterial::getUpdatedAt));
    }

    @Override
    @Transactional
    public OfficialResumeMaterial usePublishedMaterial(Long userId, Long materialId) {
        OfficialResumeMaterial material = officialMaterialMapper.selectById(materialId);
        if (material == null || !"PUBLISHED".equals(material.getStatus())) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "官方参考素材不存在");
        }
        jdbcTemplate.update("UPDATE official_resume_material SET use_count = use_count + 1 WHERE id = ?", materialId);
        recordUsage(userId, "OFFICIAL_MATERIAL", materialId, "APPLY");
        material.setUseCount((material.getUseCount() == null ? 0 : material.getUseCount()) + 1);
        return material;
    }

    @Override
    public List<ResumeContentTemplate> listPublishedTemplates(String query, String targetRole) {
        var wrapper = new LambdaQueryWrapper<ResumeContentTemplate>()
                .eq(ResumeContentTemplate::getStatus, "PUBLISHED");
        if (hasText(targetRole)) wrapper.like(ResumeContentTemplate::getTargetRole, targetRole.strip());
        if (hasText(query)) {
            String keyword = query.strip();
            wrapper.and(item -> item.like(ResumeContentTemplate::getTitle, keyword)
                    .or().like(ResumeContentTemplate::getSummary, keyword)
                    .or().like(ResumeContentTemplate::getTargetRole, keyword));
        }
        return contentTemplateMapper.selectList(wrapper
                .orderByDesc(ResumeContentTemplate::getUseCount)
                .orderByDesc(ResumeContentTemplate::getUpdatedAt));
    }

    @Override
    @Transactional
    public ResumeListVO createResumeFromTemplate(Long userId, Long templateId, ContentTemplateCreateResumeDTO dto) {
        ResumeContentTemplate template = contentTemplateMapper.selectById(templateId);
        if (template == null || !"PUBLISHED".equals(template.getStatus())) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "内容模板不存在");
        }
        ResumeImportDTO request = new ResumeImportDTO();
        request.setTitle(dto.getTitle().strip());
        request.setTemplateId(template.getLayoutTemplateId());
        List<ResumeImportModuleDTO> modules = new ArrayList<>();
        for (int index = 0; index < template.getModules().size(); index++) {
            Map<String, Object> item = template.getModules().get(index);
            String moduleType = Objects.toString(item.get("moduleType"), "");
            Object rawContent = item.get("content");
            ResumeImportModuleDTO module = new ResumeImportModuleDTO();
            module.setModuleType(normalizeModuleType(moduleType));
            module.setContent(copyMap(rawContent));
            module.setSortOrder(index);
            modules.add(module);
        }
        request.setModules(modules);
        ResumeListVO resume = resumeImportService.importResume(userId, request);
        jdbcTemplate.update("UPDATE resume_content_template SET use_count = use_count + 1 WHERE id = ?", templateId);
        recordUsage(userId, "CONTENT_TEMPLATE", templateId, "CREATE_RESUME");
        return resume;
    }

    @Override
    public List<OfficialResumeMaterial> listAdminMaterials() {
        return officialMaterialMapper.selectList(new LambdaQueryWrapper<OfficialResumeMaterial>()
                .orderByDesc(OfficialResumeMaterial::getUpdatedAt)
                .orderByDesc(OfficialResumeMaterial::getId));
    }

    @Override
    public OfficialResumeMaterial createOfficialMaterial(Long adminUserId, OfficialMaterialUpsertDTO dto) {
        OfficialResumeMaterial material = new OfficialResumeMaterial();
        material.setCreatedBy(adminUserId);
        material.setVersion(1);
        material.setUseCount(0L);
        applyOfficialMaterial(material, adminUserId, dto, false);
        officialMaterialMapper.insert(material);
        return material;
    }

    @Override
    public OfficialResumeMaterial updateOfficialMaterial(Long adminUserId, Long materialId, OfficialMaterialUpsertDTO dto) {
        OfficialResumeMaterial material = officialMaterialMapper.selectById(materialId);
        if (material == null) throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "官方素材不存在");
        applyOfficialMaterial(material, adminUserId, dto, true);
        officialMaterialMapper.updateById(material);
        return material;
    }

    @Override
    public List<ResumeContentTemplate> listAdminTemplates() {
        return contentTemplateMapper.selectList(new LambdaQueryWrapper<ResumeContentTemplate>()
                .orderByDesc(ResumeContentTemplate::getUpdatedAt)
                .orderByDesc(ResumeContentTemplate::getId));
    }

    @Override
    public ResumeContentTemplate createContentTemplate(Long adminUserId, ContentTemplateUpsertDTO dto) {
        ResumeContentTemplate template = new ResumeContentTemplate();
        template.setCreatedBy(adminUserId);
        template.setVersion(1);
        template.setUseCount(0L);
        applyContentTemplate(template, adminUserId, dto, false);
        contentTemplateMapper.insert(template);
        return template;
    }

    @Override
    public ResumeContentTemplate updateContentTemplate(Long adminUserId, Long templateId, ContentTemplateUpsertDTO dto) {
        ResumeContentTemplate template = contentTemplateMapper.selectById(templateId);
        if (template == null) throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "内容模板不存在");
        applyContentTemplate(template, adminUserId, dto, true);
        contentTemplateMapper.updateById(template);
        return template;
    }

    @Override
    public Map<String, Object> generateAiDraft(LibraryAiDraftRequestDTO dto) {
        normalizeModuleType(dto.getModuleType());
        validateContent(dto.getFacts() == null ? Map.of() : dto.getFacts());
        return aiService.generateLibraryDraft(dto);
    }

    private void applyUserMaterial(UserResumeMaterial material, ResumeMaterialUpsertDTO dto) {
        String moduleType = normalizeModuleType(dto.getModuleType());
        if ("basic_info".equals(moduleType)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "基本信息请保存到我的常用资料");
        }
        material.setModuleType(moduleType);
        material.setTitle(dto.getTitle().strip());
        material.setContent(copyMap(dto.getContent()));
        material.setTags(normalizeTags(dto.getTags()));
        material.setStatus("ACTIVE");
        validateContent(material.getContent());
        requireMeaningfulContent(material.getContent());
    }

    private void applyOfficialMaterial(OfficialResumeMaterial material, Long adminUserId,
                                       OfficialMaterialUpsertDTO dto, boolean updating) {
        String moduleType = normalizeModuleType(dto.getModuleType());
        if ("basic_info".equals(moduleType)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "官方素材不能包含个人基本信息");
        }
        String nextStatus = normalizeStatus(dto.getStatus());
        material.setModuleType(moduleType);
        material.setTitle(dto.getTitle().strip());
        material.setTargetRole(normalizeOptional(dto.getTargetRole()));
        material.setCareerStage(normalizeOptional(dto.getCareerStage()));
        material.setContent(copyMap(dto.getContent()));
        material.setTags(normalizeTags(dto.getTags()));
        material.setStatus(nextStatus);
        material.setSourceType(normalizeSourceType(dto.getSourceType()));
        material.setUpdatedBy(adminUserId);
        if (updating) material.setVersion(Math.max(1, material.getVersion() == null ? 1 : material.getVersion()) + 1);
        validateContent(material.getContent());
        requireMeaningfulContent(material.getContent());
    }

    private void applyContentTemplate(ResumeContentTemplate template, Long adminUserId,
                                      ContentTemplateUpsertDTO dto, boolean updating) {
        List<Map<String, Object>> modules = new ArrayList<>();
        for (Map<String, Object> raw : dto.getModules()) {
            String type = normalizeModuleType(Objects.toString(raw.get("moduleType"), ""));
            Map<String, Object> content = copyMap(raw.get("content"));
            if ("basic_info".equals(type)) content = stripOfficialBasicInfo(content);
            validateContent(content);
            requireMeaningfulContent(content);
            modules.add(Map.of("moduleType", type, "content", content));
        }
        template.setTitle(dto.getTitle().strip());
        template.setSummary(normalizeOptional(dto.getSummary()));
        template.setTargetRole(normalizeOptional(dto.getTargetRole()));
        template.setCareerStage(normalizeOptional(dto.getCareerStage()));
        template.setLayoutTemplateId(hasText(dto.getLayoutTemplateId()) ? dto.getLayoutTemplateId().strip() : "default");
        template.setModules(modules);
        template.setTags(normalizeTags(dto.getTags()));
        template.setStatus(normalizeStatus(dto.getStatus()));
        template.setSourceType(normalizeSourceType(dto.getSourceType()));
        template.setUpdatedBy(adminUserId);
        if (updating) template.setVersion(Math.max(1, template.getVersion() == null ? 1 : template.getVersion()) + 1);
    }

    private UserResumeMaterial requireOwnedMaterial(Long userId, Long materialId) {
        UserResumeMaterial material = userMaterialMapper.selectById(materialId);
        if (material == null || !userId.equals(material.getUserId())) {
            throw new BusinessException(ResultCode.NOT_FOUND.getCode(), "个人资料不存在");
        }
        return material;
    }

    private Map<String, Object> sanitizeProfile(Map<String, Object> content) {
        Map<String, Object> result = new LinkedHashMap<>();
        content.forEach((key, value) -> {
            if (PROFILE_FIELDS.contains(key)) result.put(key, value);
        });
        return result;
    }

    private Map<String, Object> stripOfficialBasicInfo(Map<String, Object> content) {
        Map<String, Object> result = new LinkedHashMap<>(content);
        Set.of("name", "email", "phone", "wechat", "photo", "photoId", "hometown", "github", "blog", "leetcode")
                .forEach(result::remove);
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> copyMap(Object value) {
        if (!(value instanceof Map<?, ?>)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "模块内容格式错误");
        }
        return objectMapper.convertValue(value, Map.class);
    }

    private void validateContent(Map<String, Object> content) {
        validateContent(content, MAX_CONTENT_CHARACTERS);
    }

    private void validateContent(Map<String, Object> content, int maxCharacters) {
        try {
            if (objectMapper.writeValueAsString(content).length() > maxCharacters) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "资料内容过长");
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "资料内容格式错误");
        }
    }

    private void validateProfileFields(Map<String, Object> content) {
        validateStringField(content, "email", value -> EMAIL_PATTERN.matcher(value).matches(),
                "邮箱格式不正确");
        validateStringField(content, "phone", value -> PHONE_PATTERN.matcher(
                value.replaceAll("[\\s()-]", "").replaceFirst("^\\+", "")
        ).matches(), "手机号格式不正确");
        validateStringField(content, "github", this::isHttpUrl, "GitHub 地址格式不正确");
        validateStringField(content, "blog", this::isHttpUrl, "博客地址格式不正确");
    }

    private void validateStringField(Map<String, Object> content, String field,
                                     java.util.function.Predicate<String> validator, String message) {
        Object raw = content.get(field);
        if (raw == null || (raw instanceof String value && value.isBlank())) return;
        if (!(raw instanceof String value) || !validator.test(value.strip())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), message);
        }
    }

    private boolean isHttpUrl(String value) {
        try {
            URI uri = URI.create(value);
            return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && !uri.getHost().isBlank();
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private void requireMeaningfulContent(Object value) {
        if (!hasMeaningfulValue(value)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "资料内容不能为空");
        }
    }

    private boolean isReusableHistoryContent(String moduleType, Map<String, Object> content) {
        return switch (moduleType) {
            case "basic_info" -> hasAnyText(content, "name", "email", "phone");
            case "education" -> hasTextValue(content, "school")
                    && hasAnyText(content, "department", "major", "degree");
            case "internship", "work_experience" -> hasTextValue(content, "company")
                    && (hasAnyText(content, "position", "projectName") || hasNestedProjectText(content));
            case "project" -> hasTextValue(content, "projectName");
            case "skill" -> hasMeaningfulValue(content.get("categories"));
            case "paper" -> hasAnyText(content, "journalName", "content");
            case "research" -> hasTextValue(content, "projectName");
            case "award" -> hasTextValue(content, "awardName");
            case "job_intention" -> hasTextValue(content, "targetPosition");
            default -> false;
        };
    }

    private String historyMaterialTitle(String moduleType, Map<String, Object> content) {
        String title = switch (moduleType) {
            case "basic_info" -> firstText(content, "name", "email", "phone");
            case "education" -> firstText(content, "school");
            case "internship", "work_experience" -> firstText(content, "company", "projectName");
            case "project", "research" -> firstText(content, "projectName");
            case "paper" -> firstText(content, "journalName");
            case "award" -> firstText(content, "awardName");
            case "job_intention" -> firstText(content, "targetPosition");
            case "skill" -> "专业技能";
            default -> "历史资料";
        };
        return title.isBlank() ? "历史资料" : title;
    }

    private String historyMaterialIdentity(String moduleType, Map<String, Object> content) {
        List<String> fields = switch (moduleType) {
            case "basic_info" -> List.of("name", "email", "phone");
            case "education" -> List.of("school", "degree", "startDate", "endDate", "major", "department");
            case "internship", "work_experience" -> List.of("company", "position", "projectName", "startDate", "endDate");
            case "project" -> List.of("projectName", "role");
            case "skill" -> List.of();
            case "paper" -> List.of("journalName", "publishTime");
            case "research" -> List.of("projectName");
            case "award" -> List.of("awardName", "awardTime");
            case "job_intention" -> List.of("targetPosition", "targetCity");
            default -> List.of();
        };
        String identity = fields.stream()
                .map(field -> normalizedText(content.get(field)))
                .collect(java.util.stream.Collectors.joining("|"));
        if (identity.replace("|", "").isBlank()) {
            try {
                identity = objectMapper.writeValueAsString(new TreeMap<>(content));
            } catch (Exception ignored) {
                identity = content.toString();
            }
        }
        return moduleType + ":" + identity;
    }

    private boolean matchesHistoryQuery(String keyword, String title, Map<String, Object> content) {
        if (keyword.isBlank()) return true;
        if (normalizeOptional(title).toLowerCase(Locale.ROOT).contains(keyword)) return true;
        try {
            return objectMapper.writeValueAsString(content).toLowerCase(Locale.ROOT).contains(keyword);
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean hasAnyText(Map<String, Object> content, String... fields) {
        return Arrays.stream(fields).anyMatch(field -> hasTextValue(content, field));
    }

    private boolean hasTextValue(Map<String, Object> content, String field) {
        return !strippedText(content.get(field)).isBlank();
    }

    private String firstText(Map<String, Object> content, String... fields) {
        return Arrays.stream(fields)
                .map(field -> strippedText(content.get(field)))
                .filter(value -> !value.isBlank())
                .findFirst()
                .orElse("");
    }

    private String normalizedText(Object value) {
        return strippedText(value).toLowerCase(Locale.ROOT);
    }

    private String strippedText(Object value) {
        return value instanceof String text ? text.strip() : "";
    }

    private boolean hasMeaningfulValue(Object value) {
        if (value instanceof String text) return !text.isBlank();
        if (value instanceof Boolean flag) return flag;
        if (value instanceof Number) return true;
        if (value instanceof Map<?, ?> map) return map.entrySet().stream()
                .filter(entry -> !"id".equals(String.valueOf(entry.getKey())))
                .anyMatch(entry -> hasMeaningfulValue(entry.getValue()));
        if (value instanceof Collection<?> collection) return collection.stream().anyMatch(this::hasMeaningfulValue);
        return false;
    }

    private boolean hasNestedProjectText(Map<String, Object> content) {
        if (!(content.get("projects") instanceof Collection<?> projects)) return false;
        return projects.stream().anyMatch(project -> project instanceof Map<?, ?> projectMap
                && (hasMeaningfulValue(projectMap.get("projectName"))
                || hasMeaningfulValue(projectMap.get("projectDescription"))
                || hasMeaningfulValue(projectMap.get("responsibilities"))));
    }

    private String normalizeModuleType(String value) {
        String normalized = normalizeOptional(value).toLowerCase(Locale.ROOT);
        if (!MODULE_TYPES.contains(normalized)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "不支持的简历资料类型");
        }
        return normalized;
    }

    private String normalizeStatus(String value) {
        String normalized = normalizeOptional(value).toUpperCase(Locale.ROOT);
        if (!OFFICIAL_STATUSES.contains(normalized)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "发布状态无效");
        }
        return normalized;
    }

    private String normalizeSourceType(String value) {
        return "AI".equalsIgnoreCase(value) ? "AI" : "MANUAL";
    }

    private List<String> normalizeTags(List<String> tags) {
        if (tags == null) return List.of();
        return tags.stream().filter(Objects::nonNull).map(String::strip).filter(item -> !item.isEmpty()).distinct().toList();
    }

    private String normalizeOptional(String value) {
        return value == null ? "" : value.strip();
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private void recordUsage(Long userId, String sourceType, Long sourceId, String action) {
        jdbcTemplate.update("""
                INSERT INTO resume_material_usage (user_id, source_type, source_id, action)
                VALUES (?, ?, ?, ?)
                """, userId, sourceType, sourceId, action);
    }
}
