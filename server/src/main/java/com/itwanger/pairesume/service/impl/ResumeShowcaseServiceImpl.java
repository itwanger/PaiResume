package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.ResumeShowcaseUpsertDTO;
import com.itwanger.pairesume.dto.ShowcaseCardDTO;
import com.itwanger.pairesume.dto.ShowcaseDetailDTO;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.entity.ResumeShowcase;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.mapper.ResumeShowcaseMapper;
import com.itwanger.pairesume.service.AiService;
import com.itwanger.pairesume.service.ResumeShowcaseService;
import com.itwanger.pairesume.service.ShowcasePurchaseService;
import com.itwanger.pairesume.util.DateTimeUtils;
import com.itwanger.pairesume.vo.ResumeCardPreviewVO;
import com.itwanger.pairesume.vo.ResumeCardProjectPreviewVO;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ResumeShowcaseServiceImpl implements ResumeShowcaseService {
    private static final String ACCESS_TYPE_PUBLIC = "PUBLIC";
    private static final String ACCESS_TYPE_LOGIN = "LOGIN";
    private static final String ACCESS_TYPE_PAID = "PAID";
    private static final Set<String> ALLOWED_ACCESS_TYPES = Set.of(
            ACCESS_TYPE_PUBLIC,
            ACCESS_TYPE_LOGIN,
            ACCESS_TYPE_PAID
    );
    private static final Set<String> PUBLIC_BASIC_INFO_FIELDS = Set.of(
            "jobIntention", "targetCity", "salaryRange", "expectedEntryDate", "workYears"
    );
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "(?i)(?<![\\w.+-])[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}(?![\\w.-])"
    );
    private static final Pattern MOBILE_PATTERN = Pattern.compile(
            "(?<!\\d)(?:(?:\\+?86)[ -]?)?1[3-9](?:[ -]?\\d){9}(?!\\d)"
    );

    private final ResumeShowcaseMapper resumeShowcaseMapper;
    private final ResumeMapper resumeMapper;
    private final ResumeModuleMapper resumeModuleMapper;
    private final ShowcasePurchaseService showcasePurchaseService;
    private final AiService aiService;

    @Override
    public List<ShowcaseCardDTO> listPublishedShowcases() {
        List<ResumeShowcase> showcases = resumeShowcaseMapper.selectList(
                new LambdaQueryWrapper<ResumeShowcase>()
                        .eq(ResumeShowcase::getPublishStatus, "PUBLISHED")
                        .orderByAsc(ResumeShowcase::getDisplayOrder)
                        .orderByDesc(ResumeShowcase::getUpdatedAt)
        );
        if (showcases.isEmpty()) return List.of();

        List<Long> resumeIds = showcases.stream()
                .map(ResumeShowcase::getResumeId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, Resume> resumesById = resumeIds.isEmpty()
                ? Map.of()
                : resumeMapper.selectBatchIds(resumeIds).stream()
                .filter(resume -> resume.getStatus() == null || resume.getStatus() == 1)
                .collect(Collectors.toMap(Resume::getId, Function.identity()));
        Set<Long> activeResumeIds = resumesById.keySet();
        Map<Long, List<ResumeModule>> modulesByResumeId = activeResumeIds.isEmpty()
                ? Map.of()
                : resumeModuleMapper.selectList(
                        new LambdaQueryWrapper<ResumeModule>()
                                .in(ResumeModule::getResumeId, activeResumeIds)
                                .orderByAsc(ResumeModule::getSortOrder)
                                .orderByAsc(ResumeModule::getId)
                ).stream().collect(Collectors.groupingBy(
                        ResumeModule::getResumeId,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        return showcases.stream()
                .map(showcase -> toCardDto(
                        showcase,
                        resumesById.get(showcase.getResumeId()),
                        modulesByResumeId.getOrDefault(showcase.getResumeId(), List.of())
                ))
                .toList();
    }

    @Override
    public ShowcaseDetailDTO getPublishedDetail(String slug, Long userId, String purchaseToken) {
        ResumeShowcase showcase = findPublishedShowcase(slug);
        String accessType = normalizedAccessType(showcase);
        boolean locked = ACCESS_TYPE_LOGIN.equals(accessType) && userId == null;
        if (ACCESS_TYPE_PAID.equals(accessType)) {
            locked = !showcasePurchaseService.isUnlocked(showcase.getId(), purchaseToken);
        }
        return toDetailDto(showcase, locked);
    }

    @Override
    public List<ResumeShowcase> listAdminShowcases() {
        return resumeShowcaseMapper.selectList(
                new LambdaQueryWrapper<ResumeShowcase>()
                        .orderByAsc(ResumeShowcase::getDisplayOrder)
                        .orderByDesc(ResumeShowcase::getUpdatedAt)
        );
    }

    @Override
    public ResumeShowcase create(Long adminUserId, ResumeShowcaseUpsertDTO dto) {
        ResumeShowcase showcase = new ResumeShowcase();
        applyUpsert(showcase, adminUserId, dto);
        resumeShowcaseMapper.insert(showcase);
        return showcase;
    }

    @Override
    public ResumeShowcase update(Long showcaseId, Long adminUserId, ResumeShowcaseUpsertDTO dto) {
        ResumeShowcase showcase = resumeShowcaseMapper.selectById(showcaseId);
        if (showcase == null) {
            throw new BusinessException(ResultCode.SHOWCASE_NOT_FOUND);
        }
        applyUpsert(showcase, adminUserId, dto);
        resumeShowcaseMapper.updateById(showcase);
        return showcase;
    }

    @Override
    public ResumeShowcase featureResume(Long resumeId, Long adminUserId, String accessType,
                                        Integer priceCents) {
        String normalizedAccessType = normalizeAccessTypeForWrite(accessType);
        int normalizedPriceCents = normalizePrice(normalizedAccessType, priceCents);
        Resume resume = requireOwnedResume(resumeId, adminUserId);
        var sourceUpdatedAt = resume.getUpdatedAt();
        ResumeShowcase showcase = findByResumeId(resumeId);
        if (showcase != null && "PUBLISHED".equals(showcase.getPublishStatus())) {
            if (!normalizedAccessType.equals(showcase.getAccessType())) {
                showcase.setAccessType(normalizedAccessType);
                showcase.setPriceCents(normalizedPriceCents);
                resumeShowcaseMapper.updateById(showcase);
            } else if (!Objects.equals(showcase.getPriceCents(), normalizedPriceCents)) {
                showcase.setPriceCents(normalizedPriceCents);
                resumeShowcaseMapper.updateById(showcase);
            }
            return showcase;
        }

        List<ResumeModule> modules = listResumeModules(resumeId);
        boolean hasShowcaseContent = modules.stream()
                .filter(module -> !"basic_info".equals(module.getModuleType()))
                .anyMatch(module -> hasMeaningfulContent(module.getContent()));
        if (!hasShowcaseContent) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "简历内容为空，无法精选");
        }

        var metadata = aiService.generateShowcaseMetadata(resume.getTitle(), modules);
        ensureResumeVersionUnchanged(resumeId, adminUserId, sourceUpdatedAt);

        var latestShowcase = findByResumeId(resumeId);
        if (latestShowcase != null) {
            if ("PUBLISHED".equals(latestShowcase.getPublishStatus())) {
                if (!normalizedAccessType.equals(latestShowcase.getAccessType())) {
                    latestShowcase.setAccessType(normalizedAccessType);
                    latestShowcase.setPriceCents(normalizedPriceCents);
                    resumeShowcaseMapper.updateById(latestShowcase);
                } else if (!Objects.equals(latestShowcase.getPriceCents(), normalizedPriceCents)) {
                    latestShowcase.setPriceCents(normalizedPriceCents);
                    resumeShowcaseMapper.updateById(latestShowcase);
                }
                return latestShowcase;
            }
            showcase = latestShowcase;
        }
        boolean creating = showcase == null;
        if (creating) {
            showcase = new ResumeShowcase();
            showcase.setResumeId(resumeId);
            showcase.setSlug("featured-" + resumeId);
            long showcaseCount = resumeShowcaseMapper.selectCount(null);
            showcase.setDisplayOrder((int) Math.min(showcaseCount, Integer.MAX_VALUE));
            showcase.setAccessType(normalizedAccessType);
            showcase.setPriceCents(normalizedPriceCents);
        }

        showcase.setScoreLabel(metadata.getDisplayLabel());
        showcase.setSummary(metadata.getSummary());
        showcase.setPublishStatus("PUBLISHED");
        showcase.setAccessType(normalizedAccessType);
        showcase.setPriceCents(normalizedPriceCents);

        if (creating) {
            try {
                resumeShowcaseMapper.insert(showcase);
            } catch (DuplicateKeyException e) {
                var concurrentShowcase = findByResumeId(resumeId);
                if (concurrentShowcase == null) {
                    throw e;
                }
                ensureResumeStillPublishable(
                        resumeId, adminUserId, sourceUpdatedAt, concurrentShowcase
                );
                if (!normalizedAccessType.equals(concurrentShowcase.getAccessType())) {
                    concurrentShowcase.setAccessType(normalizedAccessType);
                    concurrentShowcase.setPriceCents(normalizedPriceCents);
                    resumeShowcaseMapper.updateById(concurrentShowcase);
                } else if (!Objects.equals(concurrentShowcase.getPriceCents(), normalizedPriceCents)) {
                    concurrentShowcase.setPriceCents(normalizedPriceCents);
                    resumeShowcaseMapper.updateById(concurrentShowcase);
                }
                return concurrentShowcase;
            }
        } else {
            resumeShowcaseMapper.updateById(showcase);
        }
        ensureResumeStillPublishable(resumeId, adminUserId, sourceUpdatedAt, showcase);
        return showcase;
    }

    @Override
    public ResumeShowcase unfeatureResume(Long resumeId, Long adminUserId) {
        requireOwnedResume(resumeId, adminUserId);
        ResumeShowcase showcase = findByResumeId(resumeId);
        if (showcase == null) {
            throw new BusinessException(ResultCode.SHOWCASE_NOT_FOUND);
        }
        if (!"DRAFT".equals(showcase.getPublishStatus())) {
            showcase.setPublishStatus("DRAFT");
            resumeShowcaseMapper.updateById(showcase);
        }
        return showcase;
    }

    @Override
    public void unpublishDeletedResume(Long resumeId) {
        unpublishResume(resumeId);
    }

    private void unpublishResume(Long resumeId) {
        ResumeShowcase showcase = resumeShowcaseMapper.selectOne(
                new LambdaQueryWrapper<ResumeShowcase>()
                        .eq(ResumeShowcase::getResumeId, resumeId)
                        .last("LIMIT 1")
        );
        if (showcase == null || "DRAFT".equals(showcase.getPublishStatus())) {
            return;
        }
        showcase.setPublishStatus("DRAFT");
        resumeShowcaseMapper.updateById(showcase);
    }

    private void ensureResumeVersionUnchanged(
            Long resumeId,
            Long adminUserId,
            LocalDateTime sourceUpdatedAt
    ) {
        Resume currentResume = requireOwnedResume(resumeId, adminUserId);
        if (!Objects.equals(sourceUpdatedAt, currentResume.getUpdatedAt())) {
            throw new BusinessException(
                    ResultCode.BAD_REQUEST.getCode(),
                    "简历内容已更新，请重新精选"
            );
        }
    }

    private void ensureResumeStillPublishable(
            Long resumeId,
            Long adminUserId,
            LocalDateTime sourceUpdatedAt,
            ResumeShowcase showcase
    ) {
        Resume currentResume = resumeMapper.selectById(resumeId);
        boolean publishable = currentResume != null
                && currentResume.getStatus() != null
                && currentResume.getStatus() != 0
                && adminUserId.equals(currentResume.getUserId())
                && Objects.equals(sourceUpdatedAt, currentResume.getUpdatedAt());
        if (publishable) {
            return;
        }

        if (!"DRAFT".equals(showcase.getPublishStatus())) {
            showcase.setPublishStatus("DRAFT");
            resumeShowcaseMapper.updateById(showcase);
        }
        if (currentResume == null || currentResume.getStatus() == null || currentResume.getStatus() == 0) {
            throw new BusinessException(ResultCode.RESUME_NOT_FOUND);
        }
        throw new BusinessException(
                ResultCode.BAD_REQUEST.getCode(),
                "简历内容已更新，请重新精选"
        );
    }

    private void applyUpsert(ResumeShowcase showcase, Long adminUserId, ResumeShowcaseUpsertDTO dto) {
        requireOwnedResume(dto.getResumeId(), adminUserId);

        ResumeShowcase existingSlug = resumeShowcaseMapper.selectOne(
                new LambdaQueryWrapper<ResumeShowcase>()
                        .eq(ResumeShowcase::getSlug, dto.getSlug().trim())
                        .last("LIMIT 1")
        );
        if (existingSlug != null && !existingSlug.getId().equals(showcase.getId())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "slug 已被占用");
        }

        showcase.setResumeId(dto.getResumeId());
        showcase.setSlug(dto.getSlug().trim());
        showcase.setScoreLabel(dto.getScoreLabel().trim());
        showcase.setSummary(dto.getSummary().trim());
        showcase.setDisplayOrder(dto.getDisplayOrder());
        showcase.setPublishStatus(dto.getPublishStatus().trim().toUpperCase());
        showcase.setAccessType(normalizeAccessTypeForWrite(dto.getAccessType()));
        showcase.setPriceCents(normalizePrice(showcase.getAccessType(), dto.getPriceCents()));
    }

    private Resume requireOwnedResume(Long resumeId, Long adminUserId) {
        Resume resume = resumeMapper.selectById(resumeId);
        if (resume == null || resume.getStatus() == null || resume.getStatus() == 0
                || !adminUserId.equals(resume.getUserId())) {
            throw new BusinessException(ResultCode.RESUME_NOT_FOUND);
        }
        return resume;
    }

    private ResumeShowcase findByResumeId(Long resumeId) {
        return resumeShowcaseMapper.selectOne(
                new LambdaQueryWrapper<ResumeShowcase>()
                        .eq(ResumeShowcase::getResumeId, resumeId)
                        .last("LIMIT 1")
        );
    }

    private List<ResumeModule> listResumeModules(Long resumeId) {
        return resumeModuleMapper.selectList(
                new LambdaQueryWrapper<ResumeModule>()
                        .eq(ResumeModule::getResumeId, resumeId)
                        .orderByAsc(ResumeModule::getSortOrder)
                        .orderByAsc(ResumeModule::getId)
        );
    }

    private boolean hasMeaningfulContent(Object value) {
        if (value == null) {
            return false;
        }
        if (value instanceof CharSequence text) {
            return !text.toString().isBlank();
        }
        if (value instanceof Map<?, ?> map) {
            return map.values().stream().anyMatch(this::hasMeaningfulContent);
        }
        if (value instanceof Iterable<?> values) {
            for (var item : values) {
                if (hasMeaningfulContent(item)) {
                    return true;
                }
            }
            return false;
        }
        return true;
    }

    private ResumeShowcase findPublishedShowcase(String slug) {
        ResumeShowcase showcase = resumeShowcaseMapper.selectOne(
                new LambdaQueryWrapper<ResumeShowcase>()
                        .eq(ResumeShowcase::getSlug, slug)
                        .eq(ResumeShowcase::getPublishStatus, "PUBLISHED")
                        .last("LIMIT 1")
        );
        if (showcase == null) {
            throw new BusinessException(ResultCode.SHOWCASE_NOT_FOUND);
        }
        return showcase;
    }

    private boolean isPublicAccess(ResumeShowcase showcase) {
        return ACCESS_TYPE_PUBLIC.equals(normalizedAccessType(showcase));
    }

    private boolean isPaidAccess(ResumeShowcase showcase) {
        return ACCESS_TYPE_PAID.equals(normalizedAccessType(showcase));
    }

    private String normalizeAccessTypeForWrite(String accessType) {
        String normalized = accessType == null
                ? ""
                : accessType.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_ACCESS_TYPES.contains(normalized)) {
            throw new BusinessException(
                    ResultCode.BAD_REQUEST.getCode(),
                    "访问类型只能是 PUBLIC、LOGIN 或 PAID"
            );
        }
        return normalized;
    }

    private int normalizePrice(String accessType, Integer priceCents) {
        if (!ACCESS_TYPE_PAID.equals(accessType)) {
            return 0;
        }
        if (priceCents == null || priceCents <= 0 || priceCents > 1_000_000) {
            throw new BusinessException(ResultCode.MARKET_PRICE_INVALID);
        }
        return priceCents;
    }

    private ShowcaseCardDTO toCardDto(ResumeShowcase showcase, Resume resume, List<ResumeModule> modules) {
        ShowcaseCardDTO dto = new ShowcaseCardDTO();
        dto.setId(showcase.getId());
        dto.setSlug(showcase.getSlug());
        dto.setTitle(resume != null ? resume.getTitle() : "官方样例");
        dto.setScoreLabel(showcase.getScoreLabel());
        dto.setSummary(showcase.getSummary());
        dto.setAccessType(normalizedAccessType(showcase));
        dto.setPriceCents(showcase.getPriceCents() == null ? 0 : showcase.getPriceCents());
        if (resume != null) {
            dto.setPageMode(resume.getPageMode());
            dto.setTemplateId(resume.getTemplateId());
            dto.setDensity(resume.getPdfDensity());
            dto.setAccentPreset(resume.getAccentPreset());
            dto.setHeadingStyle(resume.getHeadingStyle());
        }
        dto.setPreview(toPublicCardPreview(modules));
        dto.setUpdatedAt(DateTimeUtils.format(showcase.getUpdatedAt()));
        return dto;
    }

    private ResumeCardPreviewVO toPublicCardPreview(List<ResumeModule> modules) {
        ResumeCardPreviewVO preview = ResumeServiceImpl.buildCardPreview(modules);
        preview.setName("");
        preview.setTargetRole(abbreviate(preview.getTargetRole(), 48));
        preview.setBasicInfo(abbreviate(preview.getBasicInfo(), 72));
        preview.setEducations(preview.getEducations().stream()
                .limit(2)
                .map(education -> abbreviate(education, 72))
                .toList());
        preview.setEducation(preview.getEducations().stream().findFirst().orElse(""));
        preview.setExperiences(preview.getExperiences().stream()
                .limit(2)
                .map(experience -> abbreviate(experience, 120))
                .toList());
        preview.setExperience(preview.getExperiences().stream().findFirst().orElse(""));
        preview.setWorkExperiences(sanitizeResponsibilities(preview.getWorkExperiences()));
        preview.setInternships(sanitizeResponsibilities(preview.getInternships()));
        preview.setProjects(preview.getProjects().stream()
                .limit(2)
                .map(project -> new ResumeCardProjectPreviewVO(
                        abbreviate(project.getTitle(), 48),
                        abbreviate(project.getDescription(), 120)
                ))
                .toList());
        preview.setProject(preview.getProjects().stream()
                .findFirst()
                .map(ResumeCardProjectPreviewVO::getTitle)
                .orElse(""));
        preview.setSkills(packSkillPreviewRows(preview.getSkills()));
        return preview;
    }

    private List<String> sanitizeResponsibilities(List<String> responsibilities) {
        return responsibilities.stream()
                .limit(2)
                .map(responsibility -> abbreviate(responsibility, 120))
                .toList();
    }

    private List<String> packSkillPreviewRows(List<String> skills) {
        List<String> values = skills.stream()
                .map(skill -> abbreviate(skill, 96))
                .filter(skill -> !skill.isBlank())
                .distinct()
                .toList();
        if (values.size() <= 2) return values;

        int bestSplit = 1;
        long bestScore = Long.MAX_VALUE;
        for (int split = 1; split < values.size(); split++) {
            String left = String.join("；", values.subList(0, split));
            String right = String.join("；", values.subList(split, values.size()));
            int overflow = Math.max(0, codePointLength(left) - 96)
                    + Math.max(0, codePointLength(right) - 96);
            long score = overflow * 10_000L + Math.abs(visualWidth(left) - visualWidth(right));
            if (score < bestScore) {
                bestScore = score;
                bestSplit = split;
            }
        }
        return List.of(
                abbreviate(String.join("；", values.subList(0, bestSplit)), 96),
                abbreviate(String.join("；", values.subList(bestSplit, values.size())), 96)
        );
    }

    private int codePointLength(String value) {
        return value.codePointCount(0, value.length());
    }

    private int visualWidth(String value) {
        return value.codePoints()
                .map(codePoint -> codePoint <= 0x7f ? 1 : 2)
                .sum();
    }

    private String abbreviate(String value, int maxLength) {
        if (value == null || maxLength <= 0) return "";
        String normalized = value.strip().replaceAll("\\s+", " ");
        normalized = EMAIL_PATTERN.matcher(normalized).replaceAll("[邮箱已隐藏]");
        normalized = MOBILE_PATTERN.matcher(normalized).replaceAll("[手机号已隐藏]");
        int codePointCount = normalized.codePointCount(0, normalized.length());
        if (codePointCount <= maxLength) return normalized;
        int endIndex = normalized.offsetByCodePoints(0, Math.max(0, maxLength - 1));
        return normalized.substring(0, endIndex) + "…";
    }

    private String normalizedAccessType(ResumeShowcase showcase) {
        String accessType = showcase.getAccessType();
        String normalized = accessType == null
                ? ""
                : accessType.trim().toUpperCase(Locale.ROOT);
        return ALLOWED_ACCESS_TYPES.contains(normalized)
                ? normalized
                : ACCESS_TYPE_PAID;
    }

    private ShowcaseDetailDTO toDetailDto(ResumeShowcase showcase, boolean locked) {
        Resume resume = resumeMapper.selectById(showcase.getResumeId());
        if (resume == null || resume.getStatus() == 0) {
            throw new BusinessException(ResultCode.SHOWCASE_NOT_FOUND);
        }

        List<ResumeModule> modules = resumeModuleMapper.selectList(
                new LambdaQueryWrapper<ResumeModule>()
                        .eq(ResumeModule::getResumeId, showcase.getResumeId())
                        .orderByAsc(ResumeModule::getSortOrder)
                        .orderByAsc(ResumeModule::getId)
        );

        ShowcaseDetailDTO dto = new ShowcaseDetailDTO();
        dto.setId(showcase.getId());
        dto.setSlug(showcase.getSlug());
        dto.setTitle(resume.getTitle());
        dto.setPageMode(resume.getPageMode());
        dto.setTemplateId(resume.getTemplateId());
        dto.setDensity(resume.getPdfDensity());
        dto.setAccentPreset(resume.getAccentPreset());
        dto.setHeadingStyle(resume.getHeadingStyle());
        dto.setScoreLabel(showcase.getScoreLabel());
        dto.setSummary(showcase.getSummary());
        dto.setAccessType(normalizedAccessType(showcase));
        dto.setPriceCents(showcase.getPriceCents() == null ? 0 : showcase.getPriceCents());
        dto.setPaymentEnabled(isPaidAccess(showcase)
                && showcase.getPriceCents() != null
                && showcase.getPriceCents() > 0
                && showcasePurchaseService.isPaymentEnabled());
        dto.setLocked(locked);
        dto.setPreview(toPublicCardPreview(modules));
        dto.setModules(locked
                ? List.of()
                : modules.stream().map(this::sanitizePublicModule).toList());
        dto.setUpdatedAt(DateTimeUtils.format(showcase.getUpdatedAt()));
        return dto;
    }

    private ResumeModule sanitizePublicModule(ResumeModule module) {
        if (!"basic_info".equals(module.getModuleType())) {
            return module;
        }

        var publicContent = new LinkedHashMap<String, Object>();
        if (module.getContent() != null) {
            for (var entry : module.getContent().entrySet()) {
                if (PUBLIC_BASIC_INFO_FIELDS.contains(entry.getKey())
                        && hasMeaningfulContent(entry.getValue())) {
                    publicContent.put(entry.getKey(), entry.getValue());
                }
            }
        }

        var sanitized = new ResumeModule();
        sanitized.setId(module.getId());
        sanitized.setResumeId(module.getResumeId());
        sanitized.setModuleType(module.getModuleType());
        sanitized.setContent(publicContent);
        sanitized.setSortOrder(module.getSortOrder());
        sanitized.setCreatedAt(module.getCreatedAt());
        sanitized.setUpdatedAt(module.getUpdatedAt());
        return sanitized;
    }
}
