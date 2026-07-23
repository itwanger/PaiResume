package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.MarketplaceFeatureProperties;
import com.itwanger.pairesume.dto.AdminMarketplaceActionDTO;
import com.itwanger.pairesume.dto.MarketplaceAppealRequestDTO;
import com.itwanger.pairesume.dto.MarketplaceReportRequestDTO;
import com.itwanger.pairesume.entity.MarketplaceGovernanceAudit;
import com.itwanger.pairesume.entity.MarketplaceListingAppeal;
import com.itwanger.pairesume.entity.MarketplaceListingReport;
import com.itwanger.pairesume.entity.ResumeMarketListing;
import com.itwanger.pairesume.mapper.MarketplaceGovernanceAuditMapper;
import com.itwanger.pairesume.mapper.MarketplaceListingAppealMapper;
import com.itwanger.pairesume.mapper.MarketplaceListingReportMapper;
import com.itwanger.pairesume.mapper.ResumeMarketListingMapper;
import com.itwanger.pairesume.service.ResumeMarketplaceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MarketplaceGovernanceServiceImplTest {
    @Mock private MarketplaceListingReportMapper reportMapper;
    @Mock private MarketplaceListingAppealMapper appealMapper;
    @Mock private MarketplaceGovernanceAuditMapper auditMapper;
    @Mock private ResumeMarketListingMapper listingMapper;
    @Mock private ResumeMarketplaceService resumeMarketplaceService;

    private MarketplaceGovernanceServiceImpl service;

    @BeforeEach
    void setUp() {
        MarketplaceFeatureProperties properties = new MarketplaceFeatureProperties();
        properties.setReportDailyIpLimit(10);
        properties.setReportDuplicateWindowHours(24);
        service = new MarketplaceGovernanceServiceImpl(
                reportMapper,
                appealMapper,
                auditMapper,
                listingMapper,
                resumeMarketplaceService,
                properties
        );
    }

    @Test
    void publicReportStoresOnlyHashedIpAndCreatesAuditTrail() {
        ResumeMarketListing listing = listing();
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(listing);
        when(reportMapper.countRecentByFingerprint(any(), any(LocalDateTime.class))).thenReturn(0L);
        when(reportMapper.countRecentByIpHash(any(), any(LocalDateTime.class))).thenReturn(0L);
        when(reportMapper.insert(any(MarketplaceListingReport.class))).thenAnswer(invocation -> {
            MarketplaceListingReport report = invocation.getArgument(0);
            report.setId(91L);
            report.setCreatedAt(LocalDateTime.now());
            return 1;
        });
        MarketplaceReportRequestDTO request = reportRequest();

        var result = service.submitReport("java-resume", request, "203.0.113.7");

        ArgumentCaptor<MarketplaceListingReport> reportCaptor =
                ArgumentCaptor.forClass(MarketplaceListingReport.class);
        verify(reportMapper).insert(reportCaptor.capture());
        MarketplaceListingReport saved = reportCaptor.getValue();
        assertEquals(64, saved.getReporterIpHash().length());
        assertNotEquals("203.0.113.7", saved.getReporterIpHash());
        assertFalse(saved.getFingerprint().contains("203.0.113.7"));
        assertEquals("OPEN", result.getProcessingStatus());
        assertEquals(91L, result.getId());
        ArgumentCaptor<MarketplaceGovernanceAudit> auditCaptor =
                ArgumentCaptor.forClass(MarketplaceGovernanceAudit.class);
        verify(auditMapper).insert(auditCaptor.capture());
        assertEquals("SUBMIT_REPORT", auditCaptor.getValue().getAction());
    }

    @Test
    void duplicateReportIsRateLimitedBeforeInsert() {
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(listing());
        when(reportMapper.countRecentByFingerprint(any(), any(LocalDateTime.class))).thenReturn(1L);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.submitReport("java-resume", reportRequest(), "203.0.113.7"));

        assertEquals(ResultCode.MARKET_REPORT_RATE_LIMITED.getCode(), exception.getCode());
        verifyNoInteractions(auditMapper);
    }

    @Test
    void creatorCanAppealRejectedPendingRevision() {
        ResumeMarketListing listing = listing();
        listing.setReviewStatus("REJECTED");
        listing.setPendingRevisionId(22L);
        when(listingMapper.selectByIdForUpdate(10L)).thenReturn(listing);
        when(appealMapper.countOpenByListingId(10L)).thenReturn(0L);
        when(appealMapper.insert(any(MarketplaceListingAppeal.class))).thenAnswer(invocation -> {
            MarketplaceListingAppeal appeal = invocation.getArgument(0);
            appeal.setId(31L);
            return 1;
        });
        MarketplaceAppealRequestDTO request = new MarketplaceAppealRequestDTO();
        request.setDescription("相关个人信息已经全部脱敏，请重新审核这个版本");

        var result = service.submitAppeal(7L, 10L, request);

        assertEquals("REVIEW_REJECTION", result.getAppealType());
        assertEquals(22L, result.getListingRevisionId());
        assertEquals("OPEN", result.getAppealStatus());
        verify(auditMapper).insert(any(MarketplaceGovernanceAudit.class));
    }

    @Test
    void adminTakedownFromReportUsesListingModerationAndClosesReport() {
        MarketplaceListingReport report = new MarketplaceListingReport();
        report.setId(91L);
        report.setListingId(10L);
        report.setProcessingStatus("OPEN");
        report.setCreatedAt(LocalDateTime.now());
        when(reportMapper.selectByIdForUpdate(91L)).thenReturn(report);
        when(listingMapper.selectById(10L)).thenReturn(listing());
        AdminMarketplaceActionDTO action = action("TAKEDOWN", "侵权材料核验成立，先下架处理");

        var result = service.handleReport(91L, 1L, action);

        verify(resumeMarketplaceService).moderate(eq(10L), eq(1L), any());
        assertEquals("RESOLVED", result.getProcessingStatus());
        assertEquals(1L, result.getHandledBy());
        assertNotNull(report.getHandledAt());
        verify(reportMapper).updateById(report);
    }

    @Test
    void approvingRejectionAppealTargetsTheSamePendingRevision() {
        MarketplaceListingAppeal appeal = new MarketplaceListingAppeal();
        appeal.setId(31L);
        appeal.setListingId(10L);
        appeal.setListingRevisionId(22L);
        appeal.setCreatorUserId(7L);
        appeal.setAppealType("REVIEW_REJECTION");
        appeal.setAppealStatus("OPEN");
        when(appealMapper.selectByIdForUpdate(31L)).thenReturn(appeal);
        ResumeMarketListing listing = listing();
        listing.setPendingRevisionId(22L);
        listing.setReviewStatus("REJECTED");
        when(listingMapper.selectByIdForUpdate(10L)).thenReturn(listing);

        var result = service.handleAppeal(
                31L, 1L, action("APPROVE", "补充材料证明内容已合规"));

        verify(resumeMarketplaceService).moderate(eq(10L), eq(1L), any());
        assertEquals("APPROVED", result.getAppealStatus());
        verify(appealMapper).updateById(appeal);
        verify(auditMapper).insert(any(MarketplaceGovernanceAudit.class));
    }

    private MarketplaceReportRequestDTO reportRequest() {
        MarketplaceReportRequestDTO request = new MarketplaceReportRequestDTO();
        request.setType("copyright");
        request.setDescription("这份简历直接复制了我发布的完整项目经历，申请核验处理");
        request.setContact("rights@example.com");
        return request;
    }

    private AdminMarketplaceActionDTO action(String action, String reason) {
        AdminMarketplaceActionDTO dto = new AdminMarketplaceActionDTO();
        dto.setAction(action);
        dto.setReason(reason);
        return dto;
    }

    private ResumeMarketListing listing() {
        ResumeMarketListing listing = new ResumeMarketListing();
        listing.setId(10L);
        listing.setSellerUserId(7L);
        listing.setSlug("java-resume");
        listing.setPublicationStatus("PUBLISHED");
        listing.setModerationStatus("APPROVED");
        listing.setReviewStatus("APPROVED");
        listing.setCurrentRevisionId(21L);
        return listing;
    }
}
