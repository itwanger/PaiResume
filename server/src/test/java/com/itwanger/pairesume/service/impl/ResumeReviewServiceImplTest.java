package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumeReviewProperties;
import com.itwanger.pairesume.dto.CreateResumeReviewRequestDTO;
import com.itwanger.pairesume.entity.*;
import com.itwanger.pairesume.mapper.*;
import com.itwanger.pairesume.payment.MarketplacePaymentGateway;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.PaymentPrepayResult;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import com.itwanger.pairesume.payment.QrCodeDataUrlGenerator;
import com.itwanger.pairesume.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.AdditionalMatchers.aryEq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResumeReviewServiceImplTest {
    @Mock private ResumeReviewRequestMapper requestMapper;
    @Mock private ResumeReviewCreditLedgerMapper ledgerMapper;
    @Mock private ResumeReviewQuotaIdentityMapper quotaIdentityMapper;
    @Mock private ResumeReviewMailOutboxMapper outboxMapper;
    @Mock private ResumeReviewAuditLogMapper auditMapper;
    @Mock private UserMapper userMapper;
    @Mock private UserAuthIdentityMapper identityMapper;
    @Mock private VerificationCodeService verificationCodeService;
    @Mock private MailService mailService;
    @Mock private PlatformConfigService platformConfigService;
    @Mock private MarketplacePaymentGateway paymentGateway;
    @Mock private QrCodeDataUrlGenerator qrCodeGenerator;

    private ResumeReviewProperties properties;
    private ResumeReviewServiceImpl service;

    @BeforeEach
    void setUp() {
        properties = new ResumeReviewProperties();
        service = new ResumeReviewServiceImpl(requestMapper, ledgerMapper, quotaIdentityMapper,
                outboxMapper, auditMapper, userMapper,
                identityMapper, verificationCodeService, mailService, platformConfigService,
                paymentGateway, qrCodeGenerator,
                properties);
        UserAuthIdentity identity = new UserAuthIdentity();
        identity.setProvider("WECHAT_SERVICE");
        identity.setPrincipal("wx-app:openid-stable");
        identity.setStatus(1);
        lenient().when(identityMapper.selectList(any())).thenReturn(List.of(identity));
        lenient().when(userMapper.selectById(7L)).thenReturn(activeMember());
        lenient().when(platformConfigService.getResumeReviewRecipientEmail())
                .thenReturn("review@paicoding.com");
        lenient().doAnswer(invocation -> {
            invocation.<ResumeReviewRequest>getArgument(0).setId(123L);
            return 1;
        }).when(requestMapper).insert(any(ResumeReviewRequest.class));
    }

    @Test
    void activeMemberCanQueueForFreeWhenPriorityPaymentIsClosed() {
        var eligibility = service.eligibility(7L);

        assertFalse(eligibility.isPaidReviewAvailable());
        assertTrue(eligibility.isMemberEligible());
        assertEquals(0, eligibility.getPriceCents());
        verifyNoInteractions(ledgerMapper, quotaIdentityMapper);
    }

    @Test
    void currentRequestLookupIsScopedByAuthenticatedUserKey() {
        ResumeReviewRequest request = new ResumeReviewRequest();
        request.setRequestNo("RR-current");
        request.setUserId(7L);
        request.setRequestStatus("AWAITING_PAYMENT");
        when(requestMapper.selectActive("RESUME_REVIEW:7")).thenReturn(request);

        var current = service.current(7L);

        assertNotNull(current);
        assertEquals("RR-current", current.getRequestNo());
        verify(requestMapper).selectActive("RESUME_REVIEW:7");
        verify(requestMapper, never()).selectActive("RESUME_REVIEW:8");
    }

    @Test
    void adminActionCountUsesTheUncappedDatabaseCount() {
        when(requestMapper.countAdminActionQueue()).thenReturn(356L);

        assertEquals(356L, service.adminActionCount());
        verify(requestMapper, never()).selectAdminQueue();
    }

    @Test
    void publicQueueReturnsOnlyMaskedOperationalFieldsInMapperOrder() {
        ResumeReviewRequest inProgress = new ResumeReviewRequest();
        inProgress.setRequestNo("RR1234567890ABCDEF");
        inProgress.setRequestStatus("ACCEPTED");
        inProgress.setPaymentStatus("PAID");
        inProgress.setPriceCents(8800);
        inProgress.setPriorityFeeCents(0);
        inProgress.setPaidAt(LocalDateTime.of(2026, 8, 25, 9, 0));
        inProgress.setContactEmail("private@example.net");
        ResumeReviewRequest priority = new ResumeReviewRequest();
        priority.setRequestNo("RRFEDCBA0987654321");
        priority.setRequestStatus("EMAILED");
        priority.setPaymentStatus("PAID");
        priority.setPriceCents(11800);
        priority.setPriorityFeeCents(3000);
        priority.setPaidAt(LocalDateTime.of(2026, 8, 25, 10, 0));
        when(requestMapper.selectPublicQueue()).thenReturn(List.of(inProgress, priority));

        var queue = service.publicQueue();

        assertEquals(2, queue.size());
        assertEquals(1, queue.get(0).getPosition());
        assertEquals("IN_PROGRESS", queue.get(0).getQueueStatus());
        assertEquals("精修单 · 90ABCDEF", queue.get(0).getPublicCode());
        assertEquals(2, queue.get(1).getPosition());
        assertEquals("WAITING", queue.get(1).getQueueStatus());
        assertTrue(queue.get(1).isPriority());
        assertEquals(3000, queue.get(1).getPriorityFeeCents());
    }

    @Test
    void bindingAnotherLoginMethodKeepsTheExistingAuditSubject() {
        UserAuthIdentity wechat = new UserAuthIdentity();
        wechat.setProvider("WECHAT_SERVICE");
        wechat.setPrincipal("wx-app:openid");
        UserAuthIdentity email = new UserAuthIdentity();
        email.setProvider("EMAIL_PASSWORD");
        email.setPrincipal("user@example.net");
        when(identityMapper.selectList(any())).thenReturn(List.of(wechat, email));
        ResumeReviewQuotaIdentity alias = new ResumeReviewQuotaIdentity();
        alias.setQuotaSubjectHash("canonical-subject");
        when(quotaIdentityMapper.selectAny(anyList())).thenReturn(alias);
        when(quotaIdentityMapper.selectById(any())).thenReturn(alias);

        User user = activeMember();
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(verificationCodeService.consumeResumeReviewContactCode(
                "contact@example.net", "123456"))
                .thenReturn(VerificationCodeService.ConsumeResult.VERIFIED);
        service.create(7L, createDto(), "127.0.0.1");

        var requestCaptor = org.mockito.ArgumentCaptor.forClass(ResumeReviewRequest.class);
        verify(requestMapper).insert(requestCaptor.capture());
        assertEquals("canonical-subject", requestCaptor.getValue().getQuotaSubjectHash());
        verify(ledgerMapper, never()).selectActiveEntitlement(anyString());
    }

    @Test
    void eligibilitySeparatesFreeMemberQueueFromOptionalPriorityPayment() {
        when(paymentGateway.provider()).thenReturn("wechat");
        var eligibility = service.eligibility(7L);

        assertTrue(eligibility.isMemberEligible());
        assertTrue(eligibility.isPaidReviewAvailable());
        assertEquals(0, eligibility.getPriceCents());
        assertEquals(100_000, eligibility.getMaxPriorityFeeCents());
        verifyNoInteractions(ledgerMapper, quotaIdentityMapper);
    }

    @Test
    void priorityRequestCreatesPaymentOnlyForThePriorityAmount() {
        User user = activeMember();
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(paymentGateway.provider()).thenReturn("wechat");
        when(verificationCodeService.consumeResumeReviewContactCode(
                "contact@example.net", "123456"))
                .thenReturn(VerificationCodeService.ConsumeResult.VERIFIED);
        when(paymentGateway.createNativeOrder(any())).thenReturn(new PaymentPrepayResult(
                "wechat", "prepay-1", "weixin://wxpay/bizpayurl?pr=test",
                LocalDateTime.now().plusMinutes(30)));
        when(qrCodeGenerator.generate(anyString())).thenReturn("data:image/png;base64,test");
        CreateResumeReviewRequestDTO dto = createDto();
        dto.setPriorityFeeCents(1200);
        var created = service.create(7L, dto, "127.0.0.1");

        assertEquals("PAID", created.getEntitlementType());
        assertEquals(1200, created.getPriceCents());
        assertEquals(0, created.getBasePriceCents());
        assertEquals(1200, created.getPriorityFeeCents());
        assertEquals("AWAITING_PAYMENT", created.getRequestStatus());
        assertEquals("PENDING", created.getPaymentStatus());
        assertNotNull(created.getOrderNo());
        verify(paymentGateway).createNativeOrder(any());
        verifyNoInteractions(outboxMapper);
    }

    @Test
    void unsentMemberRequestCanUpgradeToPriorityInPlace() {
        ResumeReviewRequest request = new ResumeReviewRequest();
        request.setId(123L);
        request.setRequestNo("RR-upgrade");
        request.setUserId(7L);
        request.setEntitlementType("MEMBERSHIP");
        request.setRequestStatus("EMAIL_PENDING");
        request.setPriceCents(0);
        request.setBasePriceCents(0);
        request.setPriorityFeeCents(0);
        request.setContactEmail("contact@example.net");
        request.setPdfOriginalFileName("resume.pdf");
        request.setPdfSizeBytes(1024L);
        request.setPdfSha256("a".repeat(64));
        when(requestMapper.selectByRequestNoForUpdate("RR-upgrade")).thenReturn(request);
        when(paymentGateway.provider()).thenReturn("wechat");
        when(paymentGateway.createNativeOrder(any())).thenReturn(new PaymentPrepayResult(
                "wechat", "prepay-upgrade", "weixin://wxpay/bizpayurl?pr=upgrade",
                LocalDateTime.now().plusMinutes(30)));
        when(qrCodeGenerator.generate(anyString())).thenReturn("data:image/png;base64,upgrade");

        var upgraded = service.upgradePriority(7L, "RR-upgrade", 6600, "127.0.0.1");

        assertEquals("RR-upgrade", upgraded.getRequestNo());
        assertEquals("PAID", upgraded.getEntitlementType());
        assertEquals("AWAITING_PAYMENT", upgraded.getRequestStatus());
        assertEquals("PENDING", upgraded.getPaymentStatus());
        assertEquals(6600, upgraded.getPriceCents());
        assertEquals(6600, upgraded.getPriorityFeeCents());
        assertNotNull(upgraded.getOrderNo());
        assertEquals("data:image/png;base64,upgrade", upgraded.getQrCodeDataUrl());
        verify(ledgerMapper).insert(argThat((ResumeReviewCreditLedger ledger) ->
                "PAID".equals(ledger.getCreditType())
                        && "RESERVED".equals(ledger.getLedgerStatus())
                        && Long.valueOf(123L).equals(ledger.getRequestId())));
        verify(paymentGateway).createNativeOrder(any());
        verify(auditMapper).insert(argThat((ResumeReviewAuditLog audit) ->
                "UPGRADE_PRIORITY".equals(audit.getAction())));
    }

    @Test
    void unsentRequestCanChangeToAnotherVerifiedContactEmail() {
        ResumeReviewRequest request = new ResumeReviewRequest();
        request.setId(123L);
        request.setRequestNo("RR-contact");
        request.setUserId(7L);
        request.setEntitlementType("MEMBERSHIP");
        request.setRequestStatus("EMAIL_PENDING");
        request.setContactEmail("contact@example.net");
        when(requestMapper.selectByRequestNoForUpdate("RR-contact")).thenReturn(request);
        when(verificationCodeService.consumeResumeReviewContactCode(
                "another@example.net", "654321"))
                .thenReturn(VerificationCodeService.ConsumeResult.VERIFIED);

        var updated = service.updateContactEmail(
                7L, "RR-contact", " Another@Example.NET ", "654321");

        assertEquals("another@example.net", updated.getContactEmail());
        verify(requestMapper).updateById(request);
        verify(auditMapper).insert(argThat((ResumeReviewAuditLog audit) ->
                "UPDATE_CONTACT_EMAIL".equals(audit.getAction())));
    }

    @Test
    void dispatchedMemberRequestCannotUpgradeToPriority() {
        ResumeReviewRequest request = new ResumeReviewRequest();
        request.setId(123L);
        request.setRequestNo("RR-already-sent");
        request.setUserId(7L);
        request.setEntitlementType("MEMBERSHIP");
        request.setRequestStatus("EMAILED");
        request.setDispatchedAt(LocalDateTime.now());
        when(requestMapper.selectByRequestNoForUpdate("RR-already-sent")).thenReturn(request);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.upgradePriority(7L, "RR-already-sent", 6600, "127.0.0.1"));

        assertEquals(ResultCode.RESUME_REVIEW_STATE_INVALID.getCode(), exception.getCode());
        verify(paymentGateway, never()).createNativeOrder(any());
        verifyNoInteractions(ledgerMapper);
    }

    @Test
    void memberFreeQueueSkipsPaymentAndWaitsForExplicitSend() {
        User user = activeMember();
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(verificationCodeService.consumeResumeReviewContactCode(
                "contact@example.net", "123456"))
                .thenReturn(VerificationCodeService.ConsumeResult.VERIFIED);

        var created = service.create(7L, createDto(), "127.0.0.1");

        assertEquals("MEMBERSHIP", created.getEntitlementType());
        assertEquals(0, created.getPriceCents());
        assertEquals("EMAIL_PENDING", created.getRequestStatus());
        assertNull(created.getOrderNo());
        assertNull(created.getPaymentStatus());
        verifyNoInteractions(outboxMapper);
        verify(paymentGateway, never()).createNativeOrder(any());
        verifyNoInteractions(ledgerMapper);
    }

    @Test
    void standaloneExportedPdfDoesNotRequireAResumeRecord() {
        User user = activeMember();
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(verificationCodeService.consumeResumeReviewContactCode(
                "contact@example.net", "123456"))
                .thenReturn(VerificationCodeService.ConsumeResult.VERIFIED);
        CreateResumeReviewRequestDTO dto = createDto();
        dto.setResumeId(null);

        var created = service.create(7L, dto, "127.0.0.1");

        assertNull(created.getResumeId());
        assertEquals("resume.pdf", created.getPdfFileName());
    }

    @Test
    void memberExplicitSendEmailsTheSelectedPdfAndEntersTheQueue() {
        byte[] pdf = testPdf();
        ResumeReviewRequest request = new ResumeReviewRequest();
        request.setId(123L);
        request.setRequestNo("RR-send");
        request.setUserId(7L);
        request.setEntitlementType("MEMBERSHIP");
        request.setRequestStatus("EMAIL_PENDING");
        request.setPriceCents(0);
        request.setBasePriceCents(0);
        request.setPriorityFeeCents(0);
        request.setContactEmail("contact@example.net");
        request.setPdfOriginalFileName("resume.pdf");
        request.setPdfSizeBytes((long) pdf.length);
        request.setPdfSha256(sha256(pdf));
        request.setContentHash(sha256(pdf));
        when(requestMapper.selectByRequestNoForUpdate("RR-send")).thenReturn(request);

        var dispatched = service.dispatch(7L, "RR-send", pdfFile(pdf));

        assertNotNull(dispatched.getDispatchedAt());
        assertNotNull(dispatched.getQueuedAt());
        assertEquals("EMAILED", dispatched.getRequestStatus());
        verify(mailService).sendResumeReview(eq("review@paicoding.com"),
                contains("resume-review-rr-send"), eq("RR-send"),
                eq("contact@example.net"), aryEq(pdf), eq("resume.pdf"));
        verifyNoInteractions(outboxMapper);
        verify(requestMapper).updateById(request);
        verify(auditMapper).insert(argThat((ResumeReviewAuditLog audit) ->
                "DISPATCH".equals(audit.getAction())));
    }

    @Test
    void rejectsPdfLargerThanFiveMegabytes() {
        byte[] pdf = new byte[5 * 1024 * 1024 + 1];
        byte[] magic = "%PDF-".getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(magic, 0, pdf, 0, magic.length);
        ResumeReviewRequest request = new ResumeReviewRequest();
        request.setId(123L);
        request.setRequestNo("RR-too-large");
        request.setUserId(7L);
        request.setEntitlementType("MEMBERSHIP");
        request.setRequestStatus("EMAIL_PENDING");
        request.setContactEmail("contact@example.net");
        request.setPdfOriginalFileName("resume.pdf");
        request.setPdfSizeBytes((long) pdf.length);
        request.setPdfSha256(sha256(pdf));
        when(requestMapper.selectByRequestNoForUpdate("RR-too-large")).thenReturn(request);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.dispatch(7L, "RR-too-large", pdfFile(pdf)));

        assertEquals(ResultCode.RESUME_REVIEW_UPLOAD_INVALID.getCode(), exception.getCode());
        verifyNoInteractions(mailService);
    }

    @Test
    void priorityRequestCannotSendBeforePaymentIsConfirmed() {
        ResumeReviewRequest request = new ResumeReviewRequest();
        request.setId(123L);
        request.setRequestNo("RR-unpaid");
        request.setUserId(7L);
        request.setEntitlementType("PAID");
        request.setRequestStatus("EMAIL_PENDING");
        request.setPaymentStatus("PENDING");
        when(requestMapper.selectByRequestNoForUpdate("RR-unpaid")).thenReturn(request);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.dispatch(7L, "RR-unpaid", pdfFile(testPdf())));

        assertEquals(ResultCode.RESUME_REVIEW_STATE_INVALID.getCode(), exception.getCode());
        verifyNoInteractions(outboxMapper);
    }

    @Test
    void concurrentIdempotentRetryIsRecheckedAfterUserLock() {
        ResumeReviewRequest existing = new ResumeReviewRequest();
        existing.setId(123L);
        existing.setRequestNo("RR-existing");
        existing.setUserId(7L);
        existing.setResumeId(1L);
        existing.setRequestStatus("EMAIL_PENDING");
        existing.setEntitlementType("WELCOME_FREE");
        existing.setPriceCents(0);
        existing.setContentHash("a".repeat(64));
        when(requestMapper.selectIdempotent(7L, "idem-1"))
                .thenReturn(null, existing);
        User user = activeMember();
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);

        var result = service.create(7L, createDto(), "127.0.0.1");

        assertEquals("RR-existing", result.getRequestNo());
        verify(requestMapper, times(2)).selectIdempotent(7L, "idem-1");
        verifyNoInteractions(verificationCodeService, paymentGateway);
        verify(requestMapper, never()).insert(any(ResumeReviewRequest.class));
    }

    @Test
    void invalidPdfMetadataDoesNotConsumeContactVerificationCode() {
        User user = activeMember();
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        CreateResumeReviewRequestDTO dto = createDto();
        dto.setFileName("resume.txt");

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.create(7L, dto, "127.0.0.1"));

        assertEquals(ResultCode.RESUME_REVIEW_UPLOAD_INVALID.getCode(),
                exception.getCode());
        verifyNoInteractions(verificationCodeService);
    }

    @Test
    void nonMemberCannotCreateFreeQueueRequest() {
        User user = activeMember();
        user.setMembershipStatus("FREE");
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.create(7L, createDto(), "127.0.0.1"));

        assertEquals(ResultCode.RESUME_REVIEW_MEMBERSHIP_REQUIRED.getCode(), exception.getCode());
        verify(paymentGateway, never()).createNativeOrder(any());
    }

    @Test
    void priorityRequestFailsClosedWhenPaymentProviderIsNotWechat() {
        User user = activeMember();
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(paymentGateway.provider()).thenReturn("disabled");
        CreateResumeReviewRequestDTO dto = createDto();
        dto.setPriorityFeeCents(1200);
        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.create(7L, dto, "127.0.0.1"));

        assertEquals(ResultCode.RESUME_REVIEW_PAID_NOT_ENABLED.getCode(), exception.getCode());
        verify(paymentGateway, never()).createNativeOrder(any());
        verifyNoInteractions(verificationCodeService);
    }

    @Test
    void adminReturnAfterSmtpAcceptanceKeepsHistoricalWelcomeLedgerConsumed() {
        ResumeReviewRequest request = new ResumeReviewRequest();
        request.setId(2L);
        request.setRequestNo("RR1");
        request.setRequestStatus("EMAILED");
        request.setEntitlementType("WELCOME_FREE");
        when(requestMapper.selectByRequestNoForUpdate("RR1")).thenReturn(request);

        service.adminReturn("RR1", 99L, "用户材料不完整");

        assertEquals("RETURNED", request.getRequestStatus());
        assertNull(request.getActiveUserKey());
        verifyNoInteractions(ledgerMapper);
    }

    @Test
    void adminReturnBeforeSmtpAcceptanceReleasesHistoricalReservedLedger() {
        ResumeReviewRequest request = new ResumeReviewRequest();
        request.setId(2L);
        request.setRequestNo("RR1");
        request.setRequestStatus("EMAIL_PENDING");
        request.setEntitlementType("WELCOME_FREE");
        ResumeReviewCreditLedger ledger = new ResumeReviewCreditLedger();
        ledger.setLedgerStatus("RESERVED");
        when(requestMapper.selectByRequestNoForUpdate("RR1")).thenReturn(request);
        when(ledgerMapper.selectByRequestForUpdate(2L)).thenReturn(ledger);

        service.adminReturn("RR1", 99L, "邮件投递前退回");

        assertEquals("RELEASED", ledger.getLedgerStatus());
        assertNull(ledger.getActiveEntitlementKey());
    }

    @Test
    void expiredAbandonedPaidOrderIsStillClosedAndReconciled() {
        ResumeReviewRequest request = new ResumeReviewRequest();
        request.setId(5L);
        request.setRequestNo("RR5");
        request.setOrderNo("PS5");
        request.setEntitlementType("PAID");
        request.setRequestStatus("RETURNED");
        request.setPaymentStatus("PENDING");
        request.setPaymentExpiresAt(LocalDateTime.now().minusMinutes(1));
        request.setProvider("wechat");
        request.setPriceCents(100);
        when(requestMapper.selectByIdForUpdate(5L)).thenReturn(request);
        when(paymentGateway.provider()).thenReturn("wechat");
        when(paymentGateway.expectedAppId()).thenReturn("app");
        when(paymentGateway.expectedMerchantId()).thenReturn("merchant");
        ProviderPaymentResult pending = new ProviderPaymentResult(PaymentProviderState.PENDING,
                "PS5", null, "app", "merchant", "CNY", 100, null);
        ProviderPaymentResult closed = new ProviderPaymentResult(PaymentProviderState.CLOSED,
                "PS5", null, "app", "merchant", "CNY", 100, null);
        when(paymentGateway.queryOrder("PS5")).thenReturn(pending, closed);

        service.reconcileExpiredPayment(5L);

        verify(paymentGateway).closeOrder("PS5");
        assertEquals("CANCELED", request.getPaymentStatus());
        assertEquals("RETURNED", request.getRequestStatus());
    }

    private CreateResumeReviewRequestDTO createDto() {
        CreateResumeReviewRequestDTO dto = new CreateResumeReviewRequestDTO();
        dto.setResumeId(1L);
        dto.setFileName("resume.pdf");
        dto.setSizeBytes(1024L);
        dto.setSha256("a".repeat(64));
        dto.setIdempotencyKey("idem-1");
        dto.setPriorityFeeCents(0);
        dto.setContactEmail("contact@example.net");
        dto.setVerificationCode("123456");
        return dto;
    }

    private User activeMember() {
        User user = new User();
        user.setId(7L);
        user.setStatus(1);
        user.setMembershipStatus("ACTIVE");
        user.setMembershipExpiresAt(LocalDateTime.now().plusDays(30));
        return user;
    }

    private byte[] testPdf() {
        return "%PDF-1.7\nPaiResume test PDF".getBytes(StandardCharsets.US_ASCII);
    }

    private MockMultipartFile pdfFile(byte[] bytes) {
        return new MockMultipartFile("file", "resume.pdf", "application/pdf", bytes);
    }

    private String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

}
