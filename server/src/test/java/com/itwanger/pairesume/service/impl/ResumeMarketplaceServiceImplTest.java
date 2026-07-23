package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.MarketplaceFeatureProperties;
import com.itwanger.pairesume.dto.AdminMarketModerationDTO;
import com.itwanger.pairesume.dto.MarketListingUpsertDTO;
import com.itwanger.pairesume.dto.MarketPrivacyConfirmationDTO;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.MarketplaceGovernanceAudit;
import com.itwanger.pairesume.entity.ResumeMarketListing;
import com.itwanger.pairesume.entity.ResumeMarketListingRevision;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.MarketplaceGovernanceAuditMapper;
import com.itwanger.pairesume.mapper.ResumeMarketListingMapper;
import com.itwanger.pairesume.mapper.ResumeMarketListingRevisionMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResumeMarketplaceServiceImplTest {
    @Mock private ResumeMarketListingMapper listingMapper;
    @Mock private ResumeMarketListingRevisionMapper revisionMapper;
    @Mock private ResumeMapper resumeMapper;
    @Mock private ResumeModuleMapper moduleMapper;
    @Mock private MarketplaceOrderLocalService marketplaceOrderLocalService;
    @Mock private MarketplaceGovernanceAuditMapper governanceAuditMapper;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;

    private ResumeMarketplaceServiceImpl service;
    private MarketplacePaymentProperties paymentProperties;

    @BeforeEach
    void setUp() {
        paymentProperties = new MarketplacePaymentProperties();
        service = new ResumeMarketplaceServiceImpl(
                listingMapper,
                revisionMapper,
                resumeMapper,
                moduleMapper,
                new ObjectMapper(),
                paymentProperties,
                marketplaceOrderLocalService,
                enabledMarketplace(),
                governanceAuditMapper,
                redisTemplate
        );
        ReflectionTestUtils.setField(service, "minPriceCents", 100);
        ReflectionTestUtils.setField(service, "maxPriceCents", 99900);
    }

    private MarketplaceFeatureProperties enabledMarketplace() {
        MarketplaceFeatureProperties properties = new MarketplaceFeatureProperties();
        properties.setEnabled(true);
        return properties;
    }

    @Test
    void publishRequiresExplicitPrivacyConfirmation() {
        MarketListingUpsertDTO request = freePublishRequest();
        request.setPrivacyConfirmed(false);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.publish(7L, 11L, request)
        );

        assertEquals(ResultCode.MARKET_PUBLIC_CONSENT_REQUIRED.getCode(), exception.getCode());
        verifyNoInteractions(listingMapper, revisionMapper, resumeMapper, moduleMapper);
    }

    @Test
    void publishCreatesImmutableRevisionWithoutInternalModuleIds() {
        LocalDateTime now = LocalDateTime.now();
        Resume resume = resume(11L, 7L, now);
        ResumeModule basicInfoModule = new ResumeModule();
        basicInfoModule.setId(98L);
        basicInfoModule.setResumeId(11L);
        basicInfoModule.setModuleType("basic_info");
        basicInfoModule.setContent(Map.of(
                "name", "安全公开",
                "photo", "https://tracker.example/view.gif"
        ));
        basicInfoModule.setSortOrder(1);
        ResumeModule module = new ResumeModule();
        module.setId(99L);
        module.setResumeId(11L);
        module.setModuleType("project");
        module.setContent(Map.of("projectName", "知识库"));
        module.setSortOrder(3);

        AtomicReference<ResumeMarketListingRevision> savedRevision = new AtomicReference<>();
        when(resumeMapper.selectOne(any(Wrapper.class))).thenReturn(resume);
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(null);
        when(moduleMapper.selectList(any(Wrapper.class))).thenReturn(List.of(basicInfoModule, module));
        when(revisionMapper.selectOne(any(Wrapper.class))).thenReturn(null);
        when(listingMapper.insert(any(ResumeMarketListing.class))).thenAnswer(invocation -> {
            ResumeMarketListing listing = invocation.getArgument(0);
            listing.setId(21L);
            listing.setCreatedAt(now);
            listing.setUpdatedAt(now);
            return 1;
        });
        when(revisionMapper.insert(any(ResumeMarketListingRevision.class))).thenAnswer(invocation -> {
            ResumeMarketListingRevision revision = invocation.getArgument(0);
            revision.setId(31L);
            revision.setCreatedAt(now);
            savedRevision.set(revision);
            return 1;
        });
        when(resumeMapper.selectById(11L)).thenReturn(resume);
        when(revisionMapper.selectById(31L)).thenAnswer(invocation -> savedRevision.get());

        var result = service.publish(7L, 11L, freePublishRequest());

        ResumeMarketListingRevision revision = savedRevision.get();
        assertNotNull(revision);
        assertEquals(1, revision.getRevisionNo());
        assertEquals("Java 后端简历", revision.getTitleSnapshot());
        assertEquals("FREE", revision.getAccessTypeSnapshot());
        assertEquals(0, revision.getPriceCentsSnapshot());
        assertEquals(64, revision.getContentHash().length());
        assertEquals(Map.of(
                "moduleType", "basic_info",
                "content", Map.of("name", "安全公开"),
                "sortOrder", 1
        ), revision.getModulesSnapshot().get(0));
        assertEquals(Map.of(
                "moduleType", "project",
                "content", Map.of("projectName", "知识库"),
                "sortOrder", 3
        ), revision.getModulesSnapshot().get(1));
        assertFalse(revision.getModulesSnapshot().get(1).containsKey("id"));
        assertFalse(revision.getModulesSnapshot().get(1).containsKey("resumeId"));
        assertEquals("UNPUBLISHED", result.getPublicationStatus());
        assertEquals("PENDING", result.getReviewStatus());
        assertNull(result.getCurrentRevisionId());
        assertEquals(31L, result.getPendingRevisionId());
        verify(listingMapper).updateById(any(ResumeMarketListing.class));
    }

    @Test
    void paidListingMustStayInsideConfiguredPriceRange() {
        MarketListingUpsertDTO request = freePublishRequest();
        request.setAccessType("PAID");
        request.setPriceCents(99);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.publish(7L, 11L, request)
        );

        assertEquals(ResultCode.MARKET_PRICE_INVALID.getCode(), exception.getCode());
        verifyNoInteractions(listingMapper, revisionMapper, resumeMapper, moduleMapper);
    }

    @Test
    void publicListAppliesSearchAccessTypeAndReturnsRealPagination() {
        ResumeMarketListing listing = paidListing("PUBLISHED", "APPROVED", 41L);
        ResumeMarketListingRevision currentRevision = revision(41L, listing.getId(), "Java 项目简历");
        when(listingMapper.countPublishedListings("Java", "PAID")).thenReturn(25L);
        when(listingMapper.selectPublishedListingIds(24L, 24L, "Java", "PAID"))
                .thenReturn(List.of(10L));
        when(listingMapper.selectBatchIds(List.of(10L))).thenReturn(List.of(listing));
        when(revisionMapper.selectById(41L)).thenReturn(currentRevision);

        var result = service.listPublished(2, 24, " Java ", "paid");

        assertEquals(25, result.getTotal());
        assertEquals(2, result.getPage());
        assertEquals(24, result.getSize());
        assertEquals(2, result.getTotalPages());
        assertEquals("Java 项目简历", result.getRecords().get(0).getTitle());
        assertEquals(42L, result.getRecords().get(0).getViewCount());
    }

    @Test
    void recordViewOnlyIncrementsPubliclyVisibleListing() {
        ResumeMarketListing listing = paidListing("PUBLISHED", "APPROVED", 41L);
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(listing);

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(any(String.class), eq("1"), eq(24L), eq(TimeUnit.HOURS)))
                .thenReturn(true);

        service.recordView("paid-resume", "203.0.113.8");

        verify(listingMapper).incrementViewCount(10L);
        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        verify(valueOperations).setIfAbsent(keyCaptor.capture(), eq("1"), eq(24L), eq(TimeUnit.HOURS));
        assertTrue(keyCaptor.getValue().matches("marketplace:view:10:[0-9a-f]{32}"));
        assertFalse(keyCaptor.getValue().contains("203.0.113.8"));
    }

    @Test
    void repeatedViewFromSameFingerprintDoesNotIncrementAgain() {
        ResumeMarketListing listing = paidListing("PUBLISHED", "APPROVED", 41L);
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(listing);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(any(String.class), eq("1"), eq(24L), eq(TimeUnit.HOURS)))
                .thenReturn(false);

        service.recordView("paid-resume", "203.0.113.8");

        verify(listingMapper, never()).incrementViewCount(any());
    }

    @Test
    void purchasedRevisionRemainsReadableAfterAuthorUnpublishes() {
        ResumeMarketListing listing = paidListing("UNPUBLISHED", "APPROVED", 41L);
        ResumeMarketListingRevision purchasedRevision = revision(40L, listing.getId(), "购买时版本");
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(listing);
        when(listingMapper.selectActiveEntitlementRevisionId(10L, 8L)).thenReturn(40L);
        when(revisionMapper.selectById(40L)).thenReturn(purchasedRevision);

        var content = service.getContent("paid-resume", 8L, false);

        assertEquals(40L, content.getRevisionId());
        assertEquals("购买时版本", content.getTitle());
    }

    @Test
    void purchasedRevisionTakesPriorityForAuthenticatedBuyerAfterCurrentVersionBecomesFree() {
        ResumeMarketListing listing = paidListing("PUBLISHED", "APPROVED", 41L);
        listing.setAccessType("FREE");
        listing.setPriceCents(0);
        ResumeMarketListingRevision currentRevision = revision(41L, listing.getId(), "最新免费版本");
        currentRevision.setAccessTypeSnapshot("FREE");
        currentRevision.setPriceCentsSnapshot(0);
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(listing);
        when(listingMapper.selectActiveEntitlementRevisionId(10L, 8L)).thenReturn(40L);
        ResumeMarketListingRevision purchasedRevision = revision(40L, listing.getId(), "购买时付费版本");
        when(revisionMapper.selectById(40L)).thenReturn(purchasedRevision);

        var content = service.getContent("paid-resume", 8L, false);

        assertEquals(40L, content.getRevisionId());
        assertEquals("购买时付费版本", content.getTitle());
    }

    @Test
    void userWithoutEntitlementSeesCurrentFreeRevision() {
        ResumeMarketListing listing = paidListing("PUBLISHED", "APPROVED", 41L);
        listing.setAccessType("FREE");
        listing.setPriceCents(0);
        ResumeMarketListingRevision currentRevision = revision(41L, listing.getId(), "最新免费版本");
        currentRevision.setAccessTypeSnapshot("FREE");
        currentRevision.setPriceCentsSnapshot(0);
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(listing);
        when(listingMapper.selectActiveEntitlementRevisionId(10L, 9L)).thenReturn(null);
        when(revisionMapper.selectById(41L)).thenReturn(currentRevision);

        var content = service.getContent("paid-resume", 9L, false);

        assertEquals(41L, content.getRevisionId());
        assertEquals("最新免费版本", content.getTitle());
    }

    @Test
    void entitlementCannotPointAtAnotherListingRevision() {
        ResumeMarketListing listing = paidListing("PUBLISHED", "APPROVED", 41L);
        ResumeMarketListingRevision foreignRevision = revision(40L, 999L, "错误版本");
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(listing);
        when(listingMapper.selectActiveEntitlementRevisionId(10L, 8L)).thenReturn(40L);
        when(revisionMapper.selectById(40L)).thenReturn(foreignRevision);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.getContent("paid-resume", 8L, false)
        );

        assertEquals(ResultCode.MARKET_ACCESS_REQUIRED.getCode(), exception.getCode());
    }

    @Test
    void paidOfferReportsPaymentCapabilityWithoutGrantingContent() {
        ResumeMarketListing listing = paidListing("PUBLISHED", "APPROVED", 41L);
        ResumeMarketListingRevision currentRevision = revision(41L, listing.getId(), "当前版本");
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(listing);
        when(listingMapper.selectActiveEntitlementRevisionId(10L, 8L)).thenReturn(null);
        when(revisionMapper.selectById(41L)).thenReturn(currentRevision);
        paymentProperties.setMarketplaceAcceptNewOrders(true);

        var access = service.getAccess("paid-resume", 8L, false);

        assertEquals("PAYMENT_REQUIRED", access.getAccessStatus());
        assertFalse(access.isCanView());
        assertTrue(access.isPaymentEnabled());
        assertEquals(500, access.getPriceCents());
    }

    @Test
    void platformSuspensionBlocksBuyerButNotOwner() {
        ResumeMarketListing listing = paidListing("PUBLISHED", "SUSPENDED", 41L);
        ResumeMarketListingRevision currentRevision = revision(41L, listing.getId(), "审核版本");
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(listing);
        when(revisionMapper.selectById(41L)).thenReturn(currentRevision);

        BusinessException buyerException = assertThrows(
                BusinessException.class,
                () -> service.getContent("paid-resume", 8L, false)
        );
        var ownerContent = service.getContent("paid-resume", 7L, false);

        assertEquals(ResultCode.MARKET_LISTING_SUSPENDED.getCode(), buyerException.getCode());
        assertEquals("审核版本", ownerContent.getTitle());
        verify(listingMapper, never()).selectActiveEntitlementRevisionId(10L, 8L);
    }

    @Test
    void refreshRevisionRequiresFreshPrivacyConfirmation() {
        MarketPrivacyConfirmationDTO request = new MarketPrivacyConfirmationDTO();
        request.setPrivacyConfirmed(false);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.refreshRevision(7L, 11L, request)
        );

        assertEquals(ResultCode.MARKET_PUBLIC_CONSENT_REQUIRED.getCode(), exception.getCode());
        verifyNoInteractions(listingMapper, revisionMapper, resumeMapper, moduleMapper);
    }

    @Test
    void deletedSourceResumeOnlyUnpublishesListingAndKeepsRevision() {
        ResumeMarketListing listing = paidListing("PUBLISHED", "APPROVED", 41L);
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(listing);

        service.unpublishDeletedResume(11L, 7L);

        assertEquals("UNPUBLISHED", listing.getPublicationStatus());
        assertEquals(41L, listing.getCurrentRevisionId());
        verify(listingMapper).updateById(listing);
        verifyNoInteractions(revisionMapper, resumeMapper, moduleMapper);
    }

    @Test
    void administratorCanSuspendListingWithoutDeletingItsRevision() {
        ResumeMarketListing listing = paidListing("PUBLISHED", "APPROVED", 41L);
        ResumeMarketListingRevision currentRevision = revision(41L, listing.getId(), "待审核版本");
        when(listingMapper.selectByIdForUpdate(10L)).thenReturn(listing);
        when(revisionMapper.selectById(41L)).thenReturn(currentRevision);
        AdminMarketModerationDTO request = new AdminMarketModerationDTO();
        request.setAction("SUSPEND");
        request.setReason("简历包含未脱敏的第三方个人信息");

        var result = service.moderate(10L, 1L, request);

        assertEquals("SUSPENDED", listing.getModerationStatus());
        assertEquals(1L, listing.getModeratedBy());
        assertNotNull(listing.getModeratedAt());
        assertEquals("简历包含未脱敏的第三方个人信息", listing.getModerationReason());
        assertEquals(41L, listing.getCurrentRevisionId());
        assertEquals("SUSPENDED", result.getModerationStatus());
        verify(listingMapper).updateById(listing);
        verify(revisionMapper, never()).deleteById(41L);
    }

    @Test
    void updatedSubmissionKeepsApprovedRevisionLiveUntilReviewPasses() {
        LocalDateTime now = LocalDateTime.now();
        Resume resume = resume(11L, 7L, now);
        ResumeMarketListing listing = paidListing("PUBLISHED", "APPROVED", 41L);
        listing.setReviewStatus("APPROVED");
        ResumeMarketListingRevision current = revision(41L, 10L, "线上版本");
        current.setContentHash("old-content-hash");
        AtomicReference<ResumeMarketListingRevision> pending = new AtomicReference<>();
        when(resumeMapper.selectOne(any(Wrapper.class))).thenReturn(resume);
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(listing);
        when(moduleMapper.selectList(any(Wrapper.class))).thenReturn(List.of());
        when(revisionMapper.selectOne(any(Wrapper.class))).thenReturn(current);
        when(revisionMapper.insert(any(ResumeMarketListingRevision.class))).thenAnswer(invocation -> {
            ResumeMarketListingRevision revision = invocation.getArgument(0);
            revision.setId(42L);
            pending.set(revision);
            return 1;
        });
        when(resumeMapper.selectById(11L)).thenReturn(resume);
        when(revisionMapper.selectById(41L)).thenReturn(current);
        when(revisionMapper.selectById(42L)).thenAnswer(invocation -> pending.get());

        var result = service.publish(7L, 11L, freePublishRequest());

        assertEquals(41L, result.getCurrentRevisionId());
        assertEquals(42L, result.getPendingRevisionId());
        assertEquals("PENDING", result.getReviewStatus());
        assertEquals("PUBLISHED", result.getPublicationStatus());
        assertEquals("PAID", listing.getAccessType());
        verify(marketplaceOrderLocalService, never()).markSaleClosed(
                any(), any(), any(Boolean.class), any(), any());
    }

    @Test
    void approvalAtomicallyPromotesPendingRevisionAndClosesOldSale() {
        ResumeMarketListing listing = paidListing("PUBLISHED", "APPROVED", 41L);
        listing.setReviewStatus("PENDING");
        listing.setPendingRevisionId(42L);
        ResumeMarketListingRevision pending = revision(42L, 10L, "审核通过版本");
        pending.setSummarySnapshot("已脱敏的新摘要");
        pending.setTagsSnapshot(List.of("Java", "后端"));
        pending.setAccessTypeSnapshot("FREE");
        pending.setPriceCentsSnapshot(0);
        when(listingMapper.selectByIdForUpdate(10L)).thenReturn(listing);
        when(revisionMapper.selectById(42L)).thenReturn(pending);
        AdminMarketModerationDTO request = new AdminMarketModerationDTO();
        request.setAction("APPROVE");
        request.setReason("隐私检查和内容检查均已通过");

        var result = service.moderate(10L, 1L, request);

        assertEquals(42L, result.getCurrentRevisionId());
        assertNull(result.getPendingRevisionId());
        assertEquals("APPROVED", result.getReviewStatus());
        assertEquals("FREE", result.getAccessType());
        assertEquals(0, result.getPriceCents());
        verify(marketplaceOrderLocalService).markSaleClosed(
                eq(10L), eq(42L), eq(true), any(LocalDateTime.class), eq("ACCESS_FREE"));
        verify(governanceAuditMapper).insert((MarketplaceGovernanceAudit) any());
    }

    @Test
    void approvalDoesNotRepublishAfterCreatorExplicitlyUnpublishes() {
        ResumeMarketListing listing = paidListing("UNPUBLISHED", "APPROVED", 41L);
        listing.setReviewStatus("PENDING");
        listing.setPendingRevisionId(42L);
        listing.setPublishAfterReview(false);
        ResumeMarketListingRevision pending = revision(42L, 10L, "审核通过但保持下架");
        when(listingMapper.selectByIdForUpdate(10L)).thenReturn(listing);
        when(revisionMapper.selectById(42L)).thenReturn(pending);
        AdminMarketModerationDTO request = new AdminMarketModerationDTO();
        request.setAction("APPROVE");
        request.setReason("内容审核通过，发布状态仍以作者最后操作为准");

        var result = service.moderate(10L, 1L, request);

        assertEquals("UNPUBLISHED", result.getPublicationStatus());
        assertEquals("APPROVED", result.getReviewStatus());
        assertEquals(42L, result.getCurrentRevisionId());
    }

    @Test
    void closedMarketplaceStillAllowsPreviouslyPurchasedRevision() {
        MarketplaceFeatureProperties disabled = new MarketplaceFeatureProperties();
        service = new ResumeMarketplaceServiceImpl(
                listingMapper,
                revisionMapper,
                resumeMapper,
                moduleMapper,
                new ObjectMapper(),
                paymentProperties,
                marketplaceOrderLocalService,
                disabled,
                governanceAuditMapper,
                redisTemplate
        );
        ReflectionTestUtils.setField(service, "minPriceCents", 100);
        ReflectionTestUtils.setField(service, "maxPriceCents", 99900);
        ResumeMarketListing listing = paidListing("PUBLISHED", "APPROVED", 41L);
        ResumeMarketListingRevision purchased = revision(40L, 10L, "已购版本");
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(listing);
        when(listingMapper.selectActiveEntitlementRevisionId(10L, 8L)).thenReturn(40L);
        when(revisionMapper.selectById(40L)).thenReturn(purchased);

        var content = service.getContent("paid-resume", 8L, false);

        assertEquals(40L, content.getRevisionId());
        assertEquals("已购版本", content.getTitle());
    }

    @Test
    void duplicatePublishReusesIdenticalSnapshotAndDoesNotCloseCurrentOrders() {
        LocalDateTime resumeUpdatedAt = LocalDateTime.now();
        Resume resume = resume(11L, 7L, resumeUpdatedAt);
        ResumeMarketListing listing = paidListing("PUBLISHED", "APPROVED", 41L);
        MarketListingUpsertDTO request = freePublishRequest();
        listing.setSummary(request.getSummary());
        listing.setTags(request.getTags());
        listing.setAccessType("FREE");
        listing.setPriceCents(0);
        ResumeMarketListingRevision latest = revision(41L, 10L, resume.getTitle());
        latest.setSummarySnapshot(request.getSummary());
        latest.setTagsSnapshot(request.getTags());
        latest.setAccessTypeSnapshot("FREE");
        latest.setPriceCentsSnapshot(0);
        latest.setSourceResumeUpdatedAt(resumeUpdatedAt.minusMinutes(1));
        latest.setContentHash(ReflectionTestUtils.invokeMethod(service, "calculateContentHash", latest));
        when(resumeMapper.selectOne(any(Wrapper.class))).thenReturn(resume);
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(listing);
        when(moduleMapper.selectList(any(Wrapper.class))).thenReturn(List.of());
        when(revisionMapper.selectOne(any(Wrapper.class))).thenReturn(latest);
        when(resumeMapper.selectById(11L)).thenReturn(resume);
        when(revisionMapper.selectById(41L)).thenReturn(latest);

        var result = service.publish(7L, 11L, request);

        assertEquals(41L, result.getCurrentRevisionId());
        assertFalse(result.isSnapshotOutdated());
        assertEquals(resumeUpdatedAt, latest.getSourceResumeUpdatedAt());
        verify(revisionMapper, never()).insert((ResumeMarketListingRevision) any());
        verify(marketplaceOrderLocalService, never()).markSaleClosed(
                any(), any(), any(Boolean.class), any(), any());
    }

    @Test
    void duplicateRefreshUpdatesOnlySnapshotProvenanceWithoutClosingOrders() {
        LocalDateTime resumeUpdatedAt = LocalDateTime.now();
        Resume resume = resume(11L, 7L, resumeUpdatedAt);
        ResumeMarketListing listing = paidListing("PUBLISHED", "APPROVED", 41L);
        ResumeMarketListingRevision latest = revision(41L, 10L, resume.getTitle());
        latest.setSummarySnapshot(listing.getSummary());
        latest.setTagsSnapshot(listing.getTags());
        latest.setSourceResumeUpdatedAt(resumeUpdatedAt.minusMinutes(1));
        latest.setContentHash(ReflectionTestUtils.invokeMethod(service, "calculateContentHash", latest));
        MarketPrivacyConfirmationDTO request = new MarketPrivacyConfirmationDTO();
        request.setPrivacyConfirmed(true);
        when(resumeMapper.selectOne(any(Wrapper.class))).thenReturn(resume);
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(listing);
        when(moduleMapper.selectList(any(Wrapper.class))).thenReturn(List.of());
        when(revisionMapper.selectOne(any(Wrapper.class))).thenReturn(latest);
        when(resumeMapper.selectById(11L)).thenReturn(resume);
        when(revisionMapper.selectById(41L)).thenReturn(latest);

        var result = service.refreshRevision(7L, 11L, request);

        assertEquals(41L, result.getCurrentRevisionId());
        assertFalse(result.isSnapshotOutdated());
        verify(revisionMapper).updateById(latest);
        verify(revisionMapper, never()).insert((ResumeMarketListingRevision) any());
        verify(marketplaceOrderLocalService, never()).markSaleClosed(
                any(), any(), any(Boolean.class), any(), any());
    }

    private MarketListingUpsertDTO freePublishRequest() {
        MarketListingUpsertDTO request = new MarketListingUpsertDTO();
        request.setAccessType("FREE");
        request.setPriceCents(0);
        request.setSummary("适合 Java 后端岗位的项目型简历");
        request.setTags(List.of("Java", "项目经历"));
        request.setPrivacyConfirmed(true);
        return request;
    }

    private Resume resume(Long id, Long userId, LocalDateTime updatedAt) {
        Resume resume = new Resume();
        resume.setId(id);
        resume.setUserId(userId);
        resume.setTitle("Java 后端简历");
        resume.setTemplateId("campus-blue");
        resume.setStatus(1);
        resume.setUpdatedAt(updatedAt);
        return resume;
    }

    private ResumeMarketListing paidListing(String publicationStatus, String moderationStatus, Long revisionId) {
        ResumeMarketListing listing = new ResumeMarketListing();
        listing.setId(10L);
        listing.setResumeId(11L);
        listing.setSellerUserId(7L);
        listing.setSlug("paid-resume");
        listing.setSummary("付费简历");
        listing.setTags(List.of("Java"));
        listing.setAccessType("PAID");
        listing.setPriceCents(500);
        listing.setViewCount(42L);
        listing.setPublicationStatus(publicationStatus);
        listing.setModerationStatus(moderationStatus);
        listing.setCurrentRevisionId(revisionId);
        return listing;
    }

    private ResumeMarketListingRevision revision(Long id, Long listingId, String title) {
        ResumeMarketListingRevision revision = new ResumeMarketListingRevision();
        revision.setId(id);
        revision.setListingId(listingId);
        revision.setRevisionNo(1);
        revision.setTitleSnapshot(title);
        revision.setTemplateIdSnapshot("campus-blue");
        revision.setSummarySnapshot("快照摘要");
        revision.setTagsSnapshot(List.of("Java"));
        revision.setAccessTypeSnapshot("PAID");
        revision.setPriceCentsSnapshot(500);
        revision.setModulesSnapshot(List.of());
        return revision;
    }
}
