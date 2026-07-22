package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.AdminMarketListingDTO;
import com.itwanger.pairesume.dto.AdminMarketModerationDTO;
import com.itwanger.pairesume.dto.CreatorMarketListingDTO;
import com.itwanger.pairesume.dto.MarketListingAccessDTO;
import com.itwanger.pairesume.dto.MarketListingCardDTO;
import com.itwanger.pairesume.dto.MarketListingContentDTO;
import com.itwanger.pairesume.dto.MarketListingUpsertDTO;
import com.itwanger.pairesume.dto.MarketPrivacyConfirmationDTO;
import com.itwanger.pairesume.dto.MarketResumeModuleDTO;
import com.itwanger.pairesume.dto.MarketplacePageDTO;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeMarketListing;
import com.itwanger.pairesume.entity.ResumeMarketListingRevision;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeMarketListingMapper;
import com.itwanger.pairesume.mapper.ResumeMarketListingRevisionMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.service.ResumeMarketplaceService;
import com.itwanger.pairesume.util.DateTimeUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ResumeMarketplaceServiceImpl implements ResumeMarketplaceService {
    private static final int MAX_PAGE_SIZE = 50;
    private static final int MAX_TAG_LENGTH = 24;
    private static final Pattern SAFE_PUBLIC_PHOTO_DATA_URL = Pattern.compile(
            "^data:image/(?:png|jpe?g|webp|gif|avif);base64,",
            Pattern.CASE_INSENSITIVE
    );

    private final ResumeMarketListingMapper listingMapper;
    private final ResumeMarketListingRevisionMapper revisionMapper;
    private final ResumeMapper resumeMapper;
    private final ResumeModuleMapper moduleMapper;
    private final ObjectMapper objectMapper;
    private final MarketplacePaymentProperties paymentProperties;
    private final MarketplaceOrderLocalService marketplaceOrderLocalService;

    @Value("${app.marketplace.min-price-cents:100}")
    private int minPriceCents;

    @Value("${app.marketplace.max-price-cents:99900}")
    private int maxPriceCents;

    @Override
    @Transactional(readOnly = true)
    public MarketplacePageDTO<MarketListingCardDTO> listPublished(
            int page,
            int size,
            String query,
            String accessType
    ) {
        int safePage = Math.max(1, page);
        int safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, size));
        String normalizedQuery = normalizeQuery(query);
        String normalizedAccessType = normalizeFilterAccessType(accessType);
        long total = listingMapper.countPublishedListings(normalizedQuery, normalizedAccessType);
        long offset = (long) (safePage - 1) * safeSize;
        List<Long> listingIds = listingMapper.selectPublishedListingIds(
                offset,
                safeSize,
                normalizedQuery,
                normalizedAccessType
        );
        List<MarketListingCardDTO> records = List.of();
        if (!listingIds.isEmpty()) {
            Map<Long, ResumeMarketListing> listingsById = listingMapper.selectBatchIds(listingIds).stream()
                    .collect(Collectors.toMap(
                            ResumeMarketListing::getId,
                            Function.identity(),
                            (left, right) -> left,
                            LinkedHashMap::new
                    ));
            records = listingIds.stream()
                    .map(listingsById::get)
                    .filter(java.util.Objects::nonNull)
                    .map(this::toCardDto)
                    .toList();
        }
        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        return new MarketplacePageDTO<>(records, total, safePage, safeSize, totalPages);
    }

    @Override
    @Transactional(readOnly = true)
    public MarketListingCardDTO getPublicOffer(String slug) {
        ResumeMarketListing listing = getBySlug(slug);
        requirePubliclyVisible(listing);
        return toCardDto(listing);
    }

    @Override
    @Transactional(readOnly = true)
    public MarketListingContentDTO getFreeContent(String slug) {
        ResumeMarketListing listing = getBySlug(slug);
        requirePubliclyVisible(listing);
        if (!"FREE".equals(listing.getAccessType())) {
            throw new BusinessException(ResultCode.MARKET_ACCESS_REQUIRED);
        }
        return toContentDto(listing, getCurrentRevision(listing));
    }

    @Override
    @Transactional(readOnly = true)
    public MarketListingAccessDTO getAccess(String slug, Long userId, boolean admin) {
        ResumeMarketListing listing = getBySlug(slug);
        AccessResolution resolution = resolveAuthenticatedAccess(listing, userId, admin);
        return toAccessDto(listing, resolution);
    }

    @Override
    @Transactional(readOnly = true)
    public MarketListingContentDTO getContent(String slug, Long userId, boolean admin) {
        ResumeMarketListing listing = getBySlug(slug);
        AccessResolution resolution = resolveAuthenticatedAccess(listing, userId, admin);
        if (!resolution.canView()) {
            throw new BusinessException(ResultCode.MARKET_ACCESS_REQUIRED);
        }
        return toContentDto(listing, getListingRevision(listing, resolution.revisionId()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<CreatorMarketListingDTO> listCreatorListings(Long userId) {
        return listingMapper.selectList(
                new LambdaQueryWrapper<ResumeMarketListing>()
                        .eq(ResumeMarketListing::getSellerUserId, userId)
                        .orderByDesc(ResumeMarketListing::getUpdatedAt)
                        .orderByDesc(ResumeMarketListing::getId)
        ).stream().map(this::toCreatorDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public CreatorMarketListingDTO getCreatorListing(Long userId, Long resumeId) {
        getOwnedResume(resumeId, userId, false);
        ResumeMarketListing listing = findByResumeId(resumeId, false);
        return listing == null ? null : toCreatorDto(listing);
    }

    @Override
    @Transactional
    public CreatorMarketListingDTO publish(Long userId, Long resumeId, MarketListingUpsertDTO dto) {
        if (!Boolean.TRUE.equals(dto.getPrivacyConfirmed())) {
            throw new BusinessException(ResultCode.MARKET_PUBLIC_CONSENT_REQUIRED);
        }

        String accessType = normalizeAccessType(dto.getAccessType());
        int priceCents = validatePrice(accessType, dto.getPriceCents());
        String summary = dto.getSummary().trim();
        List<String> tags = normalizeTags(dto.getTags());
        Resume resume = getOwnedResume(resumeId, userId, true);
        ResumeMarketListing listing = findByResumeId(resumeId, true);
        LocalDateTime now = LocalDateTime.now();

        if (listing == null) {
            listing = new ResumeMarketListing();
            listing.setResumeId(resumeId);
            listing.setSellerUserId(userId);
            listing.setSlug(buildSlug(resumeId));
            listing.setModerationStatus("APPROVED");
            listing.setPublicationStatus("UNPUBLISHED");
            listing.setVersion(0);
            applySettings(listing, accessType, priceCents, summary, tags, now);
            listingMapper.insert(listing);
        } else {
            verifyListingOwnership(listing, userId);
            applySettings(listing, accessType, priceCents, summary, tags, now);
        }

        Long previousRevisionId = listing.getCurrentRevisionId();
        ResumeMarketListingRevision revision = createRevision(listing, resume);
        boolean revisionChanged = !Objects.equals(previousRevisionId, revision.getId());
        listing.setCurrentRevisionId(revision.getId());
        listing.setPublicationStatus("PUBLISHED");
        if (listing.getPublishedAt() == null) {
            listing.setPublishedAt(now);
        }
        listing.setVersion(nextVersion(listing));
        listingMapper.updateById(listing);
        if (revisionChanged) {
            marketplaceOrderLocalService.markSaleClosed(
                    listing.getId(), listing.getCurrentRevisionId(), "FREE".equals(accessType), now,
                    "FREE".equals(accessType) ? "ACCESS_FREE" : "REVISION_REPLACED");
        }
        return toCreatorDto(listing);
    }

    @Override
    @Transactional
    public CreatorMarketListingDTO unpublish(Long userId, Long resumeId) {
        getOwnedResume(resumeId, userId, true);
        ResumeMarketListing listing = requireCreatorListing(resumeId, userId, true);
        listing.setPublicationStatus("UNPUBLISHED");
        listing.setVersion(nextVersion(listing));
        listingMapper.updateById(listing);
        marketplaceOrderLocalService.markSaleClosed(
                listing.getId(), listing.getCurrentRevisionId(), true, LocalDateTime.now(),
                "AUTHOR_UNPUBLISH");
        return toCreatorDto(listing);
    }

    @Override
    @Transactional
    public void unpublishDeletedResume(Long resumeId, Long userId) {
        ResumeMarketListing listing = findByResumeId(resumeId, true);
        if (listing == null) {
            return;
        }
        verifyListingOwnership(listing, userId);
        if (!"UNPUBLISHED".equals(listing.getPublicationStatus())) {
            listing.setPublicationStatus("UNPUBLISHED");
            listing.setVersion(nextVersion(listing));
            listingMapper.updateById(listing);
            marketplaceOrderLocalService.markSaleClosed(
                    listing.getId(), listing.getCurrentRevisionId(), true, LocalDateTime.now(),
                    "DELETE");
        }
    }

    @Override
    @Transactional
    public CreatorMarketListingDTO refreshRevision(
            Long userId,
            Long resumeId,
            MarketPrivacyConfirmationDTO dto
    ) {
        if (dto == null || !Boolean.TRUE.equals(dto.getPrivacyConfirmed())) {
            throw new BusinessException(ResultCode.MARKET_PUBLIC_CONSENT_REQUIRED);
        }
        Resume resume = getOwnedResume(resumeId, userId, true);
        ResumeMarketListing listing = requireCreatorListing(resumeId, userId, true);
        Long previousRevisionId = listing.getCurrentRevisionId();
        ResumeMarketListingRevision revision = createRevision(listing, resume);
        boolean revisionChanged = !Objects.equals(previousRevisionId, revision.getId());
        listing.setCurrentRevisionId(revision.getId());
        listing.setPublicConsentAt(LocalDateTime.now());
        listing.setVersion(nextVersion(listing));
        listingMapper.updateById(listing);
        if (revisionChanged) {
            marketplaceOrderLocalService.markSaleClosed(
                    listing.getId(), listing.getCurrentRevisionId(), false, LocalDateTime.now(),
                    "REVISION_REPLACED");
        }
        return toCreatorDto(listing);
    }

    @Override
    @Transactional(readOnly = true)
    public MarketplacePageDTO<AdminMarketListingDTO> listAdminListings(
            int page,
            int size,
            String publicationStatus,
            String moderationStatus
    ) {
        int safePage = Math.max(1, page);
        int safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, size));
        String normalizedPublication = normalizeOptionalStatus(
                publicationStatus,
                List.of("PUBLISHED", "UNPUBLISHED"),
                "发布状态筛选值无效"
        );
        String normalizedModeration = normalizeOptionalStatus(
                moderationStatus,
                List.of("APPROVED", "SUSPENDED"),
                "审核状态筛选值无效"
        );
        LambdaQueryWrapper<ResumeMarketListing> query = new LambdaQueryWrapper<ResumeMarketListing>()
                .eq(StringUtils.hasText(normalizedPublication),
                        ResumeMarketListing::getPublicationStatus, normalizedPublication)
                .eq(StringUtils.hasText(normalizedModeration),
                        ResumeMarketListing::getModerationStatus, normalizedModeration)
                .orderByDesc(ResumeMarketListing::getUpdatedAt)
                .orderByDesc(ResumeMarketListing::getId);
        Page<ResumeMarketListing> result = listingMapper.selectPage(
                new Page<>(safePage, safeSize, true),
                query
        );
        int totalPages = result.getTotal() == 0
                ? 0
                : (int) Math.ceil((double) result.getTotal() / safeSize);
        return new MarketplacePageDTO<>(
                result.getRecords().stream().map(this::toAdminDto).toList(),
                result.getTotal(),
                safePage,
                safeSize,
                totalPages
        );
    }

    @Override
    @Transactional
    public AdminMarketListingDTO moderate(
            Long listingId,
            Long adminUserId,
            AdminMarketModerationDTO dto
    ) {
        if (dto == null || !StringUtils.hasText(dto.getReason())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "审核原因不能为空");
        }
        String action = dto.getAction() == null
                ? ""
                : dto.getAction().trim().toUpperCase(Locale.ROOT);
        String moderationStatus;
        if ("APPROVE".equals(action) || "APPROVED".equals(action)) {
            moderationStatus = "APPROVED";
        } else if ("SUSPEND".equals(action) || "SUSPENDED".equals(action)) {
            moderationStatus = "SUSPENDED";
        } else {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "审核动作仅支持 APPROVE 或 SUSPEND");
        }

        ResumeMarketListing listing = listingMapper.selectOne(
                new LambdaQueryWrapper<ResumeMarketListing>()
                        .eq(ResumeMarketListing::getId, listingId)
                        .last("LIMIT 1 FOR UPDATE")
        );
        if (listing == null) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_FOUND);
        }
        listing.setModerationStatus(moderationStatus);
        listing.setModeratedBy(adminUserId);
        listing.setModeratedAt(LocalDateTime.now());
        listing.setModerationReason(dto.getReason().trim());
        listing.setVersion(nextVersion(listing));
        listingMapper.updateById(listing);
        if ("SUSPENDED".equals(moderationStatus)) {
            marketplaceOrderLocalService.markSaleClosed(
                    listing.getId(), listing.getCurrentRevisionId(), true, LocalDateTime.now(),
                    "MODERATION_SUSPEND");
        }
        return toAdminDto(listing);
    }

    private void applySettings(
            ResumeMarketListing listing,
            String accessType,
            int priceCents,
            String summary,
            List<String> tags,
            LocalDateTime consentAt
    ) {
        listing.setAccessType(accessType);
        listing.setPriceCents(priceCents);
        listing.setSummary(summary);
        listing.setTags(tags);
        listing.setPublicConsentAt(consentAt);
    }

    private ResumeMarketListingRevision createRevision(ResumeMarketListing listing, Resume resume) {
        List<ResumeModule> modules = moduleMapper.selectList(
                new LambdaQueryWrapper<ResumeModule>()
                        .eq(ResumeModule::getResumeId, resume.getId())
                        .orderByAsc(ResumeModule::getSortOrder)
                        .orderByAsc(ResumeModule::getId)
                        .last("FOR UPDATE")
        );
        List<Map<String, Object>> moduleSnapshots = modules.stream()
                .map(this::toModuleSnapshot)
                .toList();

        ResumeMarketListingRevision latest = revisionMapper.selectOne(
                new LambdaQueryWrapper<ResumeMarketListingRevision>()
                        .eq(ResumeMarketListingRevision::getListingId, listing.getId())
                        .orderByDesc(ResumeMarketListingRevision::getRevisionNo)
                        .last("LIMIT 1")
        );

        ResumeMarketListingRevision candidate = new ResumeMarketListingRevision();
        candidate.setListingId(listing.getId());
        candidate.setRevisionNo(latest == null ? 1 : latest.getRevisionNo() + 1);
        candidate.setTitleSnapshot(resume.getTitle());
        candidate.setTemplateIdSnapshot(StringUtils.hasText(resume.getTemplateId()) ? resume.getTemplateId() : "default");
        candidate.setSummarySnapshot(listing.getSummary());
        candidate.setTagsSnapshot(copyTags(listing.getTags()));
        candidate.setAccessTypeSnapshot(listing.getAccessType());
        candidate.setPriceCentsSnapshot(listing.getPriceCents());
        candidate.setModulesSnapshot(moduleSnapshots);
        candidate.setSourceResumeUpdatedAt(resume.getUpdatedAt());
        candidate.setContentHash(calculateContentHash(candidate));

        if (latest != null && Objects.equals(latest.getContentHash(), candidate.getContentHash())) {
            if (!Objects.equals(latest.getSourceResumeUpdatedAt(), resume.getUpdatedAt())) {
                latest.setSourceResumeUpdatedAt(resume.getUpdatedAt());
                revisionMapper.updateById(latest);
            }
            return latest;
        }
        revisionMapper.insert(candidate);
        return candidate;
    }

    private Map<String, Object> toModuleSnapshot(ResumeModule module) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("moduleType", module.getModuleType());
        Map<String, Object> content = module.getContent() == null
                ? new LinkedHashMap<>()
                : new LinkedHashMap<>(module.getContent());
        removeUnsafePublicPhoto(module.getModuleType(), content);
        snapshot.put("content", content);
        snapshot.put("sortOrder", module.getSortOrder() == null ? 0 : module.getSortOrder());
        return snapshot;
    }

    private void removeUnsafePublicPhoto(String moduleType, Map<String, Object> content) {
        if (!"basic_info".equals(moduleType)) {
            return;
        }
        Object photo = content.get("photo");
        if (photo instanceof String value && SAFE_PUBLIC_PHOTO_DATA_URL.matcher(value.trim()).find()) {
            return;
        }
        content.remove("photo");
    }

    private String calculateContentHash(ResumeMarketListingRevision revision) {
        Map<String, Object> hashSource = new LinkedHashMap<>();
        hashSource.put("title", revision.getTitleSnapshot());
        hashSource.put("templateId", revision.getTemplateIdSnapshot());
        hashSource.put("summary", revision.getSummarySnapshot());
        hashSource.put("tags", revision.getTagsSnapshot());
        hashSource.put("accessType", revision.getAccessTypeSnapshot());
        hashSource.put("priceCents", revision.getPriceCentsSnapshot());
        hashSource.put("modules", revision.getModulesSnapshot());
        try {
            byte[] payload = objectMapper.writeValueAsString(hashSource).getBytes(StandardCharsets.UTF_8);
            return toHex(MessageDigest.getInstance("SHA-256").digest(payload));
        } catch (JsonProcessingException | NoSuchAlgorithmException exception) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "生成公开简历快照失败");
        }
    }

    private String toHex(byte[] value) {
        StringBuilder builder = new StringBuilder(value.length * 2);
        for (byte item : value) {
            builder.append(String.format("%02x", item));
        }
        return builder.toString();
    }

    private AccessResolution resolveAuthenticatedAccess(
            ResumeMarketListing listing,
            Long userId,
            boolean admin
    ) {
        if (admin) {
            return new AccessResolution("ADMIN", true, requireCurrentRevisionId(listing));
        }
        if (userId != null && userId.equals(listing.getSellerUserId())) {
            return new AccessResolution("OWNER", true, requireCurrentRevisionId(listing));
        }
        if ("SUSPENDED".equals(listing.getModerationStatus())) {
            throw new BusinessException(ResultCode.MARKET_LISTING_SUSPENDED);
        }

        Long entitledRevisionId = userId == null
                ? null
                : listingMapper.selectActiveEntitlementRevisionId(listing.getId(), userId);
        if (entitledRevisionId != null) {
            return new AccessResolution("PURCHASED", true, entitledRevisionId);
        }

        if ("PUBLISHED".equals(listing.getPublicationStatus())
                && "APPROVED".equals(listing.getModerationStatus())
                && "FREE".equals(listing.getAccessType())) {
            return new AccessResolution("FREE", true, requireCurrentRevisionId(listing));
        }

        if (!"PUBLISHED".equals(listing.getPublicationStatus())) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_PUBLISHED);
        }
        return new AccessResolution("PAYMENT_REQUIRED", false, requireCurrentRevisionId(listing));
    }

    private void requirePubliclyVisible(ResumeMarketListing listing) {
        if ("SUSPENDED".equals(listing.getModerationStatus())) {
            throw new BusinessException(ResultCode.MARKET_LISTING_SUSPENDED);
        }
        if (!"PUBLISHED".equals(listing.getPublicationStatus())
                || !"APPROVED".equals(listing.getModerationStatus())) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_PUBLISHED);
        }
        requireCurrentRevisionId(listing);
    }

    private Resume getOwnedResume(Long resumeId, Long userId, boolean lock) {
        LambdaQueryWrapper<Resume> query = new LambdaQueryWrapper<Resume>()
                .eq(Resume::getId, resumeId)
                .eq(Resume::getUserId, userId)
                .eq(Resume::getStatus, 1)
                .last(lock ? "LIMIT 1 FOR UPDATE" : "LIMIT 1");
        Resume resume = resumeMapper.selectOne(query);
        if (resume == null) {
            throw new BusinessException(ResultCode.RESUME_NOT_FOUND);
        }
        return resume;
    }

    private ResumeMarketListing requireCreatorListing(Long resumeId, Long userId, boolean lock) {
        ResumeMarketListing listing = findByResumeId(resumeId, lock);
        if (listing == null) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_FOUND);
        }
        verifyListingOwnership(listing, userId);
        return listing;
    }

    private void verifyListingOwnership(ResumeMarketListing listing, Long userId) {
        if (!userId.equals(listing.getSellerUserId())) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_FOUND);
        }
    }

    private ResumeMarketListing findByResumeId(Long resumeId, boolean lock) {
        return listingMapper.selectOne(
                new LambdaQueryWrapper<ResumeMarketListing>()
                        .eq(ResumeMarketListing::getResumeId, resumeId)
                        .last(lock ? "LIMIT 1 FOR UPDATE" : "LIMIT 1")
        );
    }

    private ResumeMarketListing getBySlug(String slug) {
        if (!StringUtils.hasText(slug)) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_FOUND);
        }
        ResumeMarketListing listing = listingMapper.selectOne(
                new LambdaQueryWrapper<ResumeMarketListing>()
                        .eq(ResumeMarketListing::getSlug, slug.trim())
                        .last("LIMIT 1")
        );
        if (listing == null) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_FOUND);
        }
        return listing;
    }

    private ResumeMarketListingRevision getCurrentRevision(ResumeMarketListing listing) {
        return getListingRevision(listing, requireCurrentRevisionId(listing));
    }

    private Long requireCurrentRevisionId(ResumeMarketListing listing) {
        if (listing.getCurrentRevisionId() == null) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_FOUND);
        }
        return listing.getCurrentRevisionId();
    }

    private ResumeMarketListingRevision getRevision(Long revisionId) {
        ResumeMarketListingRevision revision = revisionMapper.selectById(revisionId);
        if (revision == null) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_FOUND);
        }
        return revision;
    }

    private ResumeMarketListingRevision getListingRevision(ResumeMarketListing listing, Long revisionId) {
        ResumeMarketListingRevision revision = getRevision(revisionId);
        if (!listing.getId().equals(revision.getListingId())) {
            throw new BusinessException(ResultCode.MARKET_ACCESS_REQUIRED);
        }
        return revision;
    }

    private MarketListingCardDTO toCardDto(ResumeMarketListing listing) {
        ResumeMarketListingRevision revision = getCurrentRevision(listing);
        MarketListingCardDTO dto = new MarketListingCardDTO();
        dto.setListingId(listing.getId());
        dto.setSlug(listing.getSlug());
        dto.setTitle(revision.getTitleSnapshot());
        dto.setSummary(revision.getSummarySnapshot());
        dto.setTags(copyTags(revision.getTagsSnapshot()));
        dto.setAccessType(revision.getAccessTypeSnapshot());
        dto.setPriceCents(revision.getPriceCentsSnapshot());
        dto.setPublicationStatus(listing.getPublicationStatus());
        dto.setModerationStatus(listing.getModerationStatus());
        dto.setUpdatedAt(DateTimeUtils.format(listing.getUpdatedAt()));
        dto.setPaymentEnabled(paymentProperties.isAcceptNewOrders());
        return dto;
    }

    private AdminMarketListingDTO toAdminDto(ResumeMarketListing listing) {
        ResumeMarketListingRevision revision = listing.getCurrentRevisionId() == null
                ? null
                : getListingRevision(listing, listing.getCurrentRevisionId());
        AdminMarketListingDTO dto = new AdminMarketListingDTO();
        dto.setId(listing.getId());
        dto.setResumeId(listing.getResumeId());
        dto.setSellerUserId(listing.getSellerUserId());
        dto.setSlug(listing.getSlug());
        dto.setTitle(revision == null ? "未生成公开版本" : revision.getTitleSnapshot());
        dto.setSummary(listing.getSummary());
        dto.setTags(copyTags(listing.getTags()));
        dto.setAccessType(listing.getAccessType());
        dto.setPriceCents(listing.getPriceCents());
        dto.setPublicationStatus(listing.getPublicationStatus());
        dto.setModerationStatus(listing.getModerationStatus());
        dto.setModeratedBy(listing.getModeratedBy());
        dto.setModeratedAt(DateTimeUtils.format(listing.getModeratedAt()));
        dto.setModerationReason(listing.getModerationReason());
        dto.setCurrentRevisionId(listing.getCurrentRevisionId());
        dto.setCreatedAt(DateTimeUtils.format(listing.getCreatedAt()));
        dto.setUpdatedAt(DateTimeUtils.format(listing.getUpdatedAt()));
        return dto;
    }

    private MarketListingContentDTO toContentDto(
            ResumeMarketListing listing,
            ResumeMarketListingRevision revision
    ) {
        MarketListingContentDTO dto = new MarketListingContentDTO();
        dto.setListingId(listing.getId());
        dto.setRevisionId(revision.getId());
        dto.setSlug(listing.getSlug());
        dto.setTitle(revision.getTitleSnapshot());
        dto.setTemplateId(revision.getTemplateIdSnapshot());
        dto.setSummary(revision.getSummarySnapshot());
        dto.setTags(copyTags(revision.getTagsSnapshot()));
        dto.setModules(toModuleDtos(revision.getModulesSnapshot()));
        dto.setAccessType(revision.getAccessTypeSnapshot());
        dto.setPriceCents(revision.getPriceCentsSnapshot());
        return dto;
    }

    private MarketListingAccessDTO toAccessDto(
            ResumeMarketListing listing,
            AccessResolution resolution
    ) {
        ResumeMarketListingRevision revision = getListingRevision(listing, resolution.revisionId());
        MarketListingAccessDTO dto = new MarketListingAccessDTO();
        dto.setListingId(listing.getId());
        dto.setSlug(listing.getSlug());
        dto.setAccessStatus(resolution.accessStatus());
        dto.setCanView(resolution.canView());
        dto.setAccessType(revision.getAccessTypeSnapshot());
        dto.setPriceCents(revision.getPriceCentsSnapshot());
        dto.setRevisionId(revision.getId());
        dto.setPaymentEnabled(paymentProperties.isAcceptNewOrders());
        return dto;
    }

    private CreatorMarketListingDTO toCreatorDto(ResumeMarketListing listing) {
        Resume resume = resumeMapper.selectById(listing.getResumeId());
        ResumeMarketListingRevision revision = listing.getCurrentRevisionId() == null
                ? null
                : getListingRevision(listing, listing.getCurrentRevisionId());
        CreatorMarketListingDTO dto = new CreatorMarketListingDTO();
        dto.setId(listing.getId());
        dto.setResumeId(listing.getResumeId());
        dto.setSlug(listing.getSlug());
        dto.setTitle(resume != null ? resume.getTitle() : revision == null ? "已删除简历" : revision.getTitleSnapshot());
        dto.setSummary(listing.getSummary());
        dto.setTags(copyTags(listing.getTags()));
        dto.setAccessType(listing.getAccessType());
        dto.setPriceCents(listing.getPriceCents());
        dto.setPublicationStatus(listing.getPublicationStatus());
        dto.setModerationStatus(listing.getModerationStatus());
        dto.setModerationReason(listing.getModerationReason());
        dto.setCurrentRevisionId(listing.getCurrentRevisionId());
        dto.setSnapshotOutdated(isSnapshotOutdated(resume, revision));
        dto.setCreatedAt(DateTimeUtils.format(listing.getCreatedAt()));
        dto.setUpdatedAt(DateTimeUtils.format(listing.getUpdatedAt()));
        return dto;
    }

    private boolean isSnapshotOutdated(Resume resume, ResumeMarketListingRevision revision) {
        return resume != null
                && resume.getUpdatedAt() != null
                && (revision == null
                || revision.getSourceResumeUpdatedAt() == null
                || resume.getUpdatedAt().isAfter(revision.getSourceResumeUpdatedAt()));
    }

    private List<MarketResumeModuleDTO> toModuleDtos(List<Map<String, Object>> snapshots) {
        if (snapshots == null) {
            return List.of();
        }
        List<MarketResumeModuleDTO> modules = new ArrayList<>(snapshots.size());
        for (Map<String, Object> snapshot : snapshots) {
            Object rawContent = snapshot.get("content");
            Map<String, Object> content = new LinkedHashMap<>();
            if (rawContent instanceof Map<?, ?> rawMap) {
                rawMap.forEach((key, value) -> content.put(String.valueOf(key), value));
            }
            Object rawSortOrder = snapshot.get("sortOrder");
            int sortOrder = rawSortOrder instanceof Number number ? number.intValue() : 0;
            modules.add(new MarketResumeModuleDTO(
                    String.valueOf(snapshot.getOrDefault("moduleType", "")),
                    content,
                    sortOrder
            ));
        }
        return modules;
    }

    private String normalizeAccessType(String accessType) {
        String normalized = accessType == null ? "" : accessType.trim().toUpperCase(Locale.ROOT);
        if (!"FREE".equals(normalized) && !"PAID".equals(normalized)) {
            throw new BusinessException(ResultCode.MARKET_PRICE_INVALID);
        }
        return normalized;
    }

    private String normalizeFilterAccessType(String accessType) {
        if (!StringUtils.hasText(accessType)) {
            return null;
        }
        String normalized = accessType.trim().toUpperCase(Locale.ROOT);
        if (!"FREE".equals(normalized) && !"PAID".equals(normalized)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "公开方式筛选值无效");
        }
        return normalized;
    }

    private String normalizeQuery(String query) {
        if (!StringUtils.hasText(query)) {
            return null;
        }
        String normalized = query.trim();
        if (normalized.length() > 64) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "搜索关键词不能超过 64 个字符");
        }
        return normalized;
    }

    private String normalizeOptionalStatus(
            String status,
            List<String> allowed,
            String errorMessage
    ) {
        if (!StringUtils.hasText(status)) {
            return null;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(normalized)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), errorMessage);
        }
        return normalized;
    }

    private int validatePrice(String accessType, Integer priceCents) {
        if (priceCents == null) {
            throw new BusinessException(ResultCode.MARKET_PRICE_INVALID);
        }
        if ("FREE".equals(accessType)) {
            if (priceCents != 0) {
                throw new BusinessException(ResultCode.MARKET_PRICE_INVALID);
            }
            return 0;
        }
        if (priceCents < minPriceCents || priceCents > maxPriceCents) {
            throw new BusinessException(ResultCode.MARKET_PRICE_INVALID);
        }
        return priceCents;
    }

    private List<String> normalizeTags(List<String> tags) {
        if (tags == null) {
            return List.of();
        }
        List<String> normalized = tags.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .toList();
        if (normalized.size() > 8 || normalized.stream().anyMatch(tag -> tag.length() > MAX_TAG_LENGTH)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "标签最多 8 个，每个不能超过 24 个字符");
        }
        return normalized;
    }

    private List<String> copyTags(List<String> tags) {
        return tags == null ? List.of() : List.copyOf(tags);
    }

    private int nextVersion(ResumeMarketListing listing) {
        return listing.getVersion() == null ? 1 : listing.getVersion() + 1;
    }

    private String buildSlug(Long resumeId) {
        return "resume-" + Long.toString(resumeId, 36) + "-"
                + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private record AccessResolution(String accessStatus, boolean canView, Long revisionId) {
    }
}
