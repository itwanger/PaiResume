package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.MarketplaceFeatureProperties;
import com.itwanger.pairesume.dto.AdminMarketModerationDTO;
import com.itwanger.pairesume.dto.AdminMarketplaceActionDTO;
import com.itwanger.pairesume.dto.MarketplaceAppealDTO;
import com.itwanger.pairesume.dto.MarketplaceAppealRequestDTO;
import com.itwanger.pairesume.dto.MarketplaceGovernanceAuditDTO;
import com.itwanger.pairesume.dto.MarketplacePageDTO;
import com.itwanger.pairesume.dto.MarketplaceReportDTO;
import com.itwanger.pairesume.dto.MarketplaceReportRequestDTO;
import com.itwanger.pairesume.entity.MarketplaceGovernanceAudit;
import com.itwanger.pairesume.entity.MarketplaceListingAppeal;
import com.itwanger.pairesume.entity.MarketplaceListingReport;
import com.itwanger.pairesume.entity.ResumeMarketListing;
import com.itwanger.pairesume.mapper.MarketplaceGovernanceAuditMapper;
import com.itwanger.pairesume.mapper.MarketplaceListingAppealMapper;
import com.itwanger.pairesume.mapper.MarketplaceListingReportMapper;
import com.itwanger.pairesume.mapper.ResumeMarketListingMapper;
import com.itwanger.pairesume.service.MarketplaceGovernanceService;
import com.itwanger.pairesume.service.ResumeMarketplaceService;
import com.itwanger.pairesume.util.DateTimeUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class MarketplaceGovernanceServiceImpl implements MarketplaceGovernanceService {
    private static final int MAX_PAGE_SIZE = 50;
    private static final Set<String> REPORT_TYPES = Set.of(
            "PRIVACY", "COPYRIGHT", "FRAUD", "ILLEGAL", "MISLEADING", "OTHER");

    private final MarketplaceListingReportMapper reportMapper;
    private final MarketplaceListingAppealMapper appealMapper;
    private final MarketplaceGovernanceAuditMapper auditMapper;
    private final ResumeMarketListingMapper listingMapper;
    private final ResumeMarketplaceService resumeMarketplaceService;
    private final MarketplaceFeatureProperties featureProperties;

    @Override
    @Transactional
    public MarketplaceReportDTO submitReport(
            String listingSlug,
            MarketplaceReportRequestDTO dto,
            String clientIp
    ) {
        if (dto == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST);
        }
        String reportType = normalizeRequiredStatus(dto.getType(), REPORT_TYPES, "举报类型不合法");
        String description = normalizeRequiredText(dto.getDescription(), 10, 1000, "举报说明");
        String contact = normalizeOptionalText(dto.getContact(), 255, "联系方式");
        ResumeMarketListing listing = findListingBySlug(listingSlug);

        LocalDateTime now = LocalDateTime.now();
        int windowHours = Math.max(1, featureProperties.getReportDuplicateWindowHours());
        String ipHash = sha256(StringUtils.hasText(clientIp) ? clientIp.trim() : "unknown");
        String fingerprint = sha256(listing.getId() + "\n" + reportType + "\n"
                + description.toLowerCase(Locale.ROOT) + "\n"
                + (contact == null ? "" : contact.toLowerCase(Locale.ROOT)) + "\n" + ipHash);
        LocalDateTime duplicateSince = now.minusHours(windowHours);
        if (reportMapper.countRecentByFingerprint(fingerprint, duplicateSince) > 0
                || reportMapper.countRecentByIpHash(ipHash, now.minusDays(1))
                >= Math.max(1, featureProperties.getReportDailyIpLimit())) {
            throw new BusinessException(ResultCode.MARKET_REPORT_RATE_LIMITED);
        }

        MarketplaceListingReport report = new MarketplaceListingReport();
        report.setListingId(listing.getId());
        report.setReportType(reportType);
        report.setDescription(description);
        report.setContact(contact);
        report.setReporterIpHash(ipHash);
        report.setFingerprint(fingerprint);
        report.setProcessingStatus("OPEN");
        reportMapper.insert(report);
        recordAudit(listing.getId(), null, "PUBLIC", "SUBMIT_REPORT", "REPORT", report.getId(),
                null, "OPEN", reportType);
        return toReportDto(report, listing.getSlug());
    }

    @Override
    @Transactional
    public MarketplaceAppealDTO submitAppeal(
            Long creatorUserId,
            Long listingId,
            MarketplaceAppealRequestDTO dto
    ) {
        if (dto == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST);
        }
        String description = normalizeRequiredText(dto.getDescription(), 10, 1000, "申诉说明");
        ResumeMarketListing listing = listingMapper.selectByIdForUpdate(listingId);
        if (listing == null || !Objects.equals(creatorUserId, listing.getSellerUserId())) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_FOUND);
        }
        if (appealMapper.countOpenByListingId(listingId) > 0) {
            throw new BusinessException(ResultCode.MARKET_APPEAL_NOT_ALLOWED.getCode(), "已有待处理申诉");
        }

        String appealType;
        Long targetRevisionId;
        if ("SUSPENDED".equals(listing.getModerationStatus()) && listing.getCurrentRevisionId() != null) {
            appealType = "TAKEDOWN";
            targetRevisionId = listing.getCurrentRevisionId();
        } else if ("REJECTED".equals(listing.getReviewStatus()) && listing.getPendingRevisionId() != null) {
            appealType = "REVIEW_REJECTION";
            targetRevisionId = listing.getPendingRevisionId();
        } else {
            throw new BusinessException(ResultCode.MARKET_APPEAL_NOT_ALLOWED);
        }

        MarketplaceListingAppeal appeal = new MarketplaceListingAppeal();
        appeal.setListingId(listingId);
        appeal.setListingRevisionId(targetRevisionId);
        appeal.setCreatorUserId(creatorUserId);
        appeal.setAppealType(appealType);
        appeal.setDescription(description);
        appeal.setAppealStatus("OPEN");
        appealMapper.insert(appeal);
        recordAudit(listingId, creatorUserId, "CREATOR", "SUBMIT_APPEAL", "APPEAL", appeal.getId(),
                null, "OPEN", appealType);
        return toAppealDto(appeal);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MarketplaceAppealDTO> listCreatorAppeals(Long creatorUserId) {
        return appealMapper.selectList(new LambdaQueryWrapper<MarketplaceListingAppeal>()
                        .eq(MarketplaceListingAppeal::getCreatorUserId, creatorUserId)
                        .orderByDesc(MarketplaceListingAppeal::getCreatedAt)
                        .orderByDesc(MarketplaceListingAppeal::getId))
                .stream().map(this::toAppealDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public MarketplacePageDTO<MarketplaceReportDTO> listReports(int page, int size, String status) {
        PageRequest safe = safePage(page, size);
        String normalizedStatus = normalizeOptionalStatus(
                status, Set.of("OPEN", "RESOLVED", "DISMISSED"), "举报状态不合法");
        LambdaQueryWrapper<MarketplaceListingReport> query = new LambdaQueryWrapper<MarketplaceListingReport>()
                .eq(StringUtils.hasText(normalizedStatus),
                        MarketplaceListingReport::getProcessingStatus, normalizedStatus)
                .orderByAsc("OPEN".equals(normalizedStatus), MarketplaceListingReport::getCreatedAt)
                .orderByDesc(!"OPEN".equals(normalizedStatus), MarketplaceListingReport::getCreatedAt)
                .orderByDesc(MarketplaceListingReport::getId);
        Page<MarketplaceListingReport> result = reportMapper.selectPage(
                new Page<>(safe.page(), safe.size(), true), query);
        return toPage(result, safe, item -> toReportDto(item, listingSlug(item.getListingId())));
    }

    @Override
    @Transactional
    public MarketplaceReportDTO handleReport(
            Long reportId,
            Long adminUserId,
            AdminMarketplaceActionDTO dto
    ) {
        ActionInput input = requireAction(dto, Set.of("RESOLVE", "DISMISS", "TAKEDOWN"));
        MarketplaceListingReport report = reportMapper.selectByIdForUpdate(reportId);
        if (report == null) {
            throw new BusinessException(ResultCode.MARKET_REPORT_NOT_FOUND);
        }
        if (!"OPEN".equals(report.getProcessingStatus())) {
            throw new BusinessException(ResultCode.MARKET_GOVERNANCE_ALREADY_HANDLED);
        }
        String nextStatus = "DISMISS".equals(input.action()) ? "DISMISSED" : "RESOLVED";
        if ("TAKEDOWN".equals(input.action())) {
            moderate(report.getListingId(), adminUserId, "TAKEDOWN", input.reason());
        }
        LocalDateTime now = LocalDateTime.now();
        report.setProcessingStatus(nextStatus);
        report.setHandledBy(adminUserId);
        report.setHandledReason(input.reason());
        report.setHandledAt(now);
        reportMapper.updateById(report);
        recordAudit(report.getListingId(), adminUserId, "ADMIN", input.action(), "REPORT", reportId,
                "OPEN", nextStatus, input.reason());
        return toReportDto(report, listingSlug(report.getListingId()));
    }

    @Override
    @Transactional(readOnly = true)
    public MarketplacePageDTO<MarketplaceAppealDTO> listAppeals(int page, int size, String status) {
        PageRequest safe = safePage(page, size);
        String normalizedStatus = normalizeOptionalStatus(
                status, Set.of("OPEN", "APPROVED", "REJECTED"), "申诉状态不合法");
        LambdaQueryWrapper<MarketplaceListingAppeal> query = new LambdaQueryWrapper<MarketplaceListingAppeal>()
                .eq(StringUtils.hasText(normalizedStatus),
                        MarketplaceListingAppeal::getAppealStatus, normalizedStatus)
                .orderByAsc("OPEN".equals(normalizedStatus), MarketplaceListingAppeal::getCreatedAt)
                .orderByDesc(!"OPEN".equals(normalizedStatus), MarketplaceListingAppeal::getCreatedAt)
                .orderByDesc(MarketplaceListingAppeal::getId);
        Page<MarketplaceListingAppeal> result = appealMapper.selectPage(
                new Page<>(safe.page(), safe.size(), true), query);
        return toPage(result, safe, this::toAppealDto);
    }

    @Override
    @Transactional
    public MarketplaceAppealDTO handleAppeal(
            Long appealId,
            Long adminUserId,
            AdminMarketplaceActionDTO dto
    ) {
        ActionInput input = requireAction(dto, Set.of("APPROVE", "REJECT"));
        MarketplaceListingAppeal appeal = appealMapper.selectByIdForUpdate(appealId);
        if (appeal == null) {
            throw new BusinessException(ResultCode.MARKET_APPEAL_NOT_FOUND);
        }
        if (!"OPEN".equals(appeal.getAppealStatus())) {
            throw new BusinessException(ResultCode.MARKET_GOVERNANCE_ALREADY_HANDLED);
        }
        String nextStatus = "APPROVE".equals(input.action()) ? "APPROVED" : "REJECTED";
        if ("APPROVE".equals(input.action())) {
            ResumeMarketListing listing = listingMapper.selectByIdForUpdate(appeal.getListingId());
            if (listing == null) {
                throw new BusinessException(ResultCode.MARKET_LISTING_NOT_FOUND);
            }
            if ("REVIEW_REJECTION".equals(appeal.getAppealType())) {
                if (!Objects.equals(appeal.getListingRevisionId(), listing.getPendingRevisionId())) {
                    throw new BusinessException(ResultCode.MARKET_APPEAL_NOT_ALLOWED.getCode(),
                            "申诉所针对的投稿版本已经变化");
                }
                moderate(appeal.getListingId(), adminUserId, "APPROVE", input.reason());
            } else if ("TAKEDOWN".equals(appeal.getAppealType())) {
                if (!Objects.equals(appeal.getListingRevisionId(), listing.getCurrentRevisionId())
                        || !"SUSPENDED".equals(listing.getModerationStatus())) {
                    throw new BusinessException(ResultCode.MARKET_APPEAL_NOT_ALLOWED.getCode(),
                            "申诉所针对的下架状态已经变化");
                }
                moderate(appeal.getListingId(), adminUserId, "RESTORE", input.reason());
            } else {
                throw new BusinessException(ResultCode.MARKET_APPEAL_NOT_ALLOWED);
            }
        }
        appeal.setAppealStatus(nextStatus);
        appeal.setHandledBy(adminUserId);
        appeal.setHandledReason(input.reason());
        appeal.setHandledAt(LocalDateTime.now());
        appealMapper.updateById(appeal);
        recordAudit(appeal.getListingId(), adminUserId, "ADMIN", input.action() + "_APPEAL",
                "APPEAL", appealId, "OPEN", nextStatus, input.reason());
        return toAppealDto(appeal);
    }

    @Override
    @Transactional(readOnly = true)
    public MarketplacePageDTO<MarketplaceGovernanceAuditDTO> listAudits(
            int page,
            int size,
            Long listingId
    ) {
        PageRequest safe = safePage(page, size);
        LambdaQueryWrapper<MarketplaceGovernanceAudit> query =
                new LambdaQueryWrapper<MarketplaceGovernanceAudit>()
                        .eq(listingId != null, MarketplaceGovernanceAudit::getListingId, listingId)
                        .orderByDesc(MarketplaceGovernanceAudit::getCreatedAt)
                        .orderByDesc(MarketplaceGovernanceAudit::getId);
        Page<MarketplaceGovernanceAudit> result = auditMapper.selectPage(
                new Page<>(safe.page(), safe.size(), true), query);
        return toPage(result, safe, this::toAuditDto);
    }

    private void moderate(Long listingId, Long adminUserId, String action, String reason) {
        AdminMarketModerationDTO moderation = new AdminMarketModerationDTO();
        moderation.setAction(action);
        moderation.setReason(reason);
        resumeMarketplaceService.moderate(listingId, adminUserId, moderation);
    }

    private ResumeMarketListing findListingBySlug(String slug) {
        if (!StringUtils.hasText(slug)) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_FOUND);
        }
        ResumeMarketListing listing = listingMapper.selectOne(new LambdaQueryWrapper<ResumeMarketListing>()
                .eq(ResumeMarketListing::getSlug, slug.trim())
                .last("LIMIT 1"));
        if (listing == null) {
            throw new BusinessException(ResultCode.MARKET_LISTING_NOT_FOUND);
        }
        return listing;
    }

    private String listingSlug(Long listingId) {
        ResumeMarketListing listing = listingMapper.selectById(listingId);
        return listing == null ? null : listing.getSlug();
    }

    private MarketplaceReportDTO toReportDto(MarketplaceListingReport report, String slug) {
        MarketplaceReportDTO dto = new MarketplaceReportDTO();
        dto.setId(report.getId());
        dto.setListingId(report.getListingId());
        dto.setListingSlug(slug);
        dto.setReportType(report.getReportType());
        dto.setDescription(report.getDescription());
        dto.setContact(report.getContact());
        dto.setProcessingStatus(report.getProcessingStatus());
        dto.setHandledBy(report.getHandledBy());
        dto.setHandledReason(report.getHandledReason());
        dto.setHandledAt(DateTimeUtils.format(report.getHandledAt()));
        dto.setCreatedAt(DateTimeUtils.format(report.getCreatedAt()));
        dto.setUpdatedAt(DateTimeUtils.format(report.getUpdatedAt()));
        return dto;
    }

    private MarketplaceAppealDTO toAppealDto(MarketplaceListingAppeal appeal) {
        MarketplaceAppealDTO dto = new MarketplaceAppealDTO();
        dto.setId(appeal.getId());
        dto.setListingId(appeal.getListingId());
        dto.setListingRevisionId(appeal.getListingRevisionId());
        dto.setCreatorUserId(appeal.getCreatorUserId());
        dto.setAppealType(appeal.getAppealType());
        dto.setDescription(appeal.getDescription());
        dto.setAppealStatus(appeal.getAppealStatus());
        dto.setHandledBy(appeal.getHandledBy());
        dto.setHandledReason(appeal.getHandledReason());
        dto.setHandledAt(DateTimeUtils.format(appeal.getHandledAt()));
        dto.setCreatedAt(DateTimeUtils.format(appeal.getCreatedAt()));
        dto.setUpdatedAt(DateTimeUtils.format(appeal.getUpdatedAt()));
        return dto;
    }

    private MarketplaceGovernanceAuditDTO toAuditDto(MarketplaceGovernanceAudit audit) {
        MarketplaceGovernanceAuditDTO dto = new MarketplaceGovernanceAuditDTO();
        dto.setId(audit.getId());
        dto.setListingId(audit.getListingId());
        dto.setActorUserId(audit.getActorUserId());
        dto.setActorType(audit.getActorType());
        dto.setAction(audit.getAction());
        dto.setTargetType(audit.getTargetType());
        dto.setTargetId(audit.getTargetId());
        dto.setFromStatus(audit.getFromStatus());
        dto.setToStatus(audit.getToStatus());
        dto.setReason(audit.getReason());
        dto.setCreatedAt(DateTimeUtils.format(audit.getCreatedAt()));
        return dto;
    }

    private ActionInput requireAction(AdminMarketplaceActionDTO dto, Set<String> allowed) {
        if (dto == null || !StringUtils.hasText(dto.getAction()) || !StringUtils.hasText(dto.getReason())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "处理动作和原因不能为空");
        }
        String action = dto.getAction().trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(action)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "处理动作不合法");
        }
        String reason = dto.getReason().trim();
        if (reason.length() > 500) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "处理原因不能超过 500 个字符");
        }
        return new ActionInput(action, reason);
    }

    private String normalizeRequiredStatus(
            String value,
            Set<String> allowed,
            String errorMessage
    ) {
        String normalized = StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : "";
        if (!allowed.contains(normalized)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), errorMessage);
        }
        return normalized;
    }

    private String normalizeOptionalStatus(String value, Set<String> allowed, String errorMessage) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return normalizeRequiredStatus(value, allowed, errorMessage);
    }

    private String normalizeRequiredText(String value, int min, int max, String label) {
        String normalized = StringUtils.hasText(value) ? value.trim() : "";
        if (normalized.length() < min || normalized.length() > max) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    label + "长度应为 " + min + " 到 " + max + " 个字符");
        }
        return normalized;
    }

    private String normalizeOptionalText(String value, int max, String label) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.length() > max) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), label + "不能超过 " + max + " 个字符");
        }
        return normalized;
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(digest.length * 2);
            for (byte item : digest) {
                result.append(String.format("%02x", item));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR);
        }
    }

    private void recordAudit(
            Long listingId,
            Long actorUserId,
            String actorType,
            String action,
            String targetType,
            Long targetId,
            String fromStatus,
            String toStatus,
            String reason
    ) {
        MarketplaceGovernanceAudit audit = new MarketplaceGovernanceAudit();
        audit.setListingId(listingId);
        audit.setActorUserId(actorUserId);
        audit.setActorType(actorType);
        audit.setAction(action);
        audit.setTargetType(targetType);
        audit.setTargetId(targetId);
        audit.setFromStatus(fromStatus);
        audit.setToStatus(toStatus);
        audit.setReason(reason);
        auditMapper.insert(audit);
    }

    private PageRequest safePage(int page, int size) {
        return new PageRequest(Math.max(1, page), Math.min(MAX_PAGE_SIZE, Math.max(1, size)));
    }

    private <T, R> MarketplacePageDTO<R> toPage(
            Page<T> result,
            PageRequest request,
            java.util.function.Function<T, R> mapper
    ) {
        int totalPages = result.getTotal() == 0
                ? 0 : (int) Math.ceil((double) result.getTotal() / request.size());
        return new MarketplacePageDTO<>(result.getRecords().stream().map(mapper).toList(),
                result.getTotal(), request.page(), request.size(), totalPages);
    }

    private record PageRequest(int page, int size) {
    }

    private record ActionInput(String action, String reason) {
    }
}
