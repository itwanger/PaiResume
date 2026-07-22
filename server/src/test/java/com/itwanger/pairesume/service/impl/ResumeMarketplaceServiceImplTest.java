package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.AdminMarketModerationDTO;
import com.itwanger.pairesume.dto.MarketListingUpsertDTO;
import com.itwanger.pairesume.dto.MarketPrivacyConfirmationDTO;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeMarketListing;
import com.itwanger.pairesume.entity.ResumeMarketListingRevision;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeMarketListingMapper;
import com.itwanger.pairesume.mapper.ResumeMarketListingRevisionMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
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
                marketplaceOrderLocalService
        );
        ReflectionTestUtils.setField(service, "minPriceCents", 100);
        ReflectionTestUtils.setField(service, "maxPriceCents", 99900);
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
        assertEquals("PUBLISHED", result.getPublicationStatus());
        assertEquals(31L, result.getCurrentRevisionId());
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
        paymentProperties.setAcceptNewOrders(true);

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
        when(listingMapper.selectOne(any(Wrapper.class))).thenReturn(listing);
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
