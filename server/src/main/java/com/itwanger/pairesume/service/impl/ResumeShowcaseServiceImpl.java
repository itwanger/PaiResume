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
import com.itwanger.pairesume.service.MembershipService;
import com.itwanger.pairesume.service.ResumeShowcaseService;
import com.itwanger.pairesume.util.DateTimeUtils;
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

@Service
@RequiredArgsConstructor
public class ResumeShowcaseServiceImpl implements ResumeShowcaseService {
    private static final String ACCESS_TYPE_FREE = "FREE";
    private static final String ACCESS_TYPE_VIP = "VIP";
    private static final Set<String> ALLOWED_ACCESS_TYPES = Set.of(ACCESS_TYPE_FREE, ACCESS_TYPE_VIP);
    private static final Set<String> PUBLIC_BASIC_INFO_FIELDS = Set.of(
            "jobIntention", "targetCity", "salaryRange", "expectedEntryDate", "workYears"
    );

    private final ResumeShowcaseMapper resumeShowcaseMapper;
    private final ResumeMapper resumeMapper;
    private final ResumeModuleMapper resumeModuleMapper;
    private final MembershipService membershipService;
    private final AiService aiService;

    @Override
    public List<ShowcaseCardDTO> listPublishedShowcases() {
        return resumeShowcaseMapper.selectList(
                new LambdaQueryWrapper<ResumeShowcase>()
                        .eq(ResumeShowcase::getPublishStatus, "PUBLISHED")
                        .orderByAsc(ResumeShowcase::getDisplayOrder)
                        .orderByDesc(ResumeShowcase::getUpdatedAt)
        ).stream().map(this::toCardDto).toList();
    }

    @Override
    public ShowcaseDetailDTO getPublicPublishedDetail(String slug) {
        ResumeShowcase showcase = findPublishedShowcase(slug);
        if (!isFreeAccess(showcase)) {
            throw new BusinessException(ResultCode.SHOWCASE_MEMBERSHIP_REQUIRED);
        }
        return toDetailDto(showcase);
    }

    @Override
    public ShowcaseDetailDTO getPublishedDetail(String slug, Long userId) {
        ResumeShowcase showcase = findPublishedShowcase(slug);
        if (!isFreeAccess(showcase) && !membershipService.isActiveMember(userId)) {
            throw new BusinessException(ResultCode.SHOWCASE_MEMBERSHIP_REQUIRED);
        }
        return toDetailDto(showcase);
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
    public ResumeShowcase featureResume(Long resumeId, Long adminUserId) {
        Resume resume = requireOwnedResume(resumeId, adminUserId);
        var sourceUpdatedAt = resume.getUpdatedAt();
        ResumeShowcase showcase = findByResumeId(resumeId);
        if (showcase != null && "PUBLISHED".equals(showcase.getPublishStatus())) {
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
            showcase.setAccessType(ACCESS_TYPE_VIP);
        }

        showcase.setScoreLabel(metadata.getDisplayLabel());
        showcase.setSummary(metadata.getSummary());
        showcase.setTags(metadata.getTags());
        showcase.setPublishStatus("PUBLISHED");
        if (showcase.getAccessType() == null || showcase.getAccessType().isBlank()) {
            showcase.setAccessType(ACCESS_TYPE_VIP);
        }

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

    @Override
    public void unpublishChangedResume(Long resumeId) {
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
        showcase.setTags(dto.getTags());
        showcase.setDisplayOrder(dto.getDisplayOrder());
        showcase.setPublishStatus(dto.getPublishStatus().trim().toUpperCase());
        showcase.setAccessType(normalizeAccessTypeForWrite(dto.getAccessType()));
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

    private boolean isFreeAccess(ResumeShowcase showcase) {
        String accessType = showcase.getAccessType();
        return accessType != null
                && ACCESS_TYPE_FREE.equals(accessType.trim().toUpperCase(Locale.ROOT));
    }

    private String normalizeAccessTypeForWrite(String accessType) {
        String normalized = accessType == null
                ? ""
                : accessType.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_ACCESS_TYPES.contains(normalized)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "访问类型只能是 FREE 或 VIP");
        }
        return normalized;
    }

    private ShowcaseCardDTO toCardDto(ResumeShowcase showcase) {
        Resume resume = resumeMapper.selectById(showcase.getResumeId());
        ShowcaseCardDTO dto = new ShowcaseCardDTO();
        dto.setId(showcase.getId());
        dto.setSlug(showcase.getSlug());
        dto.setTitle(resume != null ? resume.getTitle() : "官方样例");
        dto.setScoreLabel(showcase.getScoreLabel());
        dto.setSummary(showcase.getSummary());
        dto.setTags(showcase.getTags());
        dto.setUpdatedAt(DateTimeUtils.format(showcase.getUpdatedAt()));
        return dto;
    }

    private ShowcaseDetailDTO toDetailDto(ResumeShowcase showcase) {
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
        dto.setTemplateId(resume.getTemplateId());
        dto.setScoreLabel(showcase.getScoreLabel());
        dto.setSummary(showcase.getSummary());
        dto.setTags(showcase.getTags());
        dto.setModules(modules.stream().map(this::sanitizePublicModule).toList());
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
