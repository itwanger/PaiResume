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

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
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
    @Mock private ResumeReviewUploadService uploadService;
    @Mock private PlatformConfigService platformConfigService;
    @Mock private VerificationCodeService verificationCodeService;
    @Mock private MailService mailService;
    @Mock private MarketplacePaymentGateway paymentGateway;
    @Mock private QrCodeDataUrlGenerator qrCodeGenerator;

    private ResumeReviewProperties properties;
    private ResumeReviewServiceImpl service;

    @BeforeEach
    void setUp() {
        properties = new ResumeReviewProperties();
        properties.setEnabled(true);
        service = new ResumeReviewServiceImpl(requestMapper, ledgerMapper, quotaIdentityMapper,
                outboxMapper, auditMapper, userMapper,
                identityMapper, uploadService, platformConfigService,
                verificationCodeService, mailService, paymentGateway, qrCodeGenerator,
                properties);
        UserAuthIdentity identity = new UserAuthIdentity();
        identity.setProvider("WECHAT_SERVICE");
        identity.setPrincipal("wx-app:openid-stable");
        identity.setStatus(1);
        lenient().when(identityMapper.selectList(any())).thenReturn(List.of(identity));
        ResumeReviewUpload readyUpload = new ResumeReviewUpload();
        readyUpload.setId(99L);
        readyUpload.setUploadNo("RU-upload");
        readyUpload.setUserId(7L);
        readyUpload.setResumeId(1L);
        readyUpload.setFinalObjectKey("pairesume/resume-review/objects/test.pdf");
        readyUpload.setObjectEtag("etag");
        readyUpload.setOriginalFileName("resume.pdf");
        readyUpload.setSizeBytes(1024L);
        readyUpload.setSha256("a".repeat(64));
        readyUpload.setUploadStatus("READY");
        lenient().when(uploadService.requireReadyForCreate(
                eq(7L), eq("RU-upload"), eq(1L))).thenReturn(readyUpload);
        lenient().doAnswer(invocation -> {
            invocation.<ResumeReviewRequest>getArgument(0).setId(123L);
            return 1;
        }).when(requestMapper).insert(any(ResumeReviewRequest.class));
    }

    @Test
    void disabledFeatureAdvertisesNoEntitlementWithoutReadingQuotaOrPrice() {
        properties.setEnabled(false);

        var eligibility = service.eligibility(7L);

        assertFalse(eligibility.isEnabled());
        assertFalse(eligibility.isWelcomeFreeAvailable());
        assertFalse(eligibility.isPaidReviewAvailable());
        assertNull(eligibility.getNextEntitlement());
        assertEquals(0, eligibility.getPriceCents());
        verifyNoInteractions(ledgerMapper, quotaIdentityMapper, platformConfigService, paymentGateway);
    }

    @Test
    void disabledFeatureRejectsAllNewRequestAndReviewMailWrites() {
        properties.setEnabled(false);

        BusinessException contactCode = assertThrows(BusinessException.class,
                () -> service.sendContactVerificationCode(
                        7L, "contact@example.net", "127.0.0.1"));
        BusinessException create = assertThrows(BusinessException.class,
                () -> service.create(7L, createDto(), "127.0.0.1"));
        BusinessException retryMail = assertThrows(BusinessException.class,
                () -> service.adminRetryMail("RR1", 99L, "retry"));

        assertEquals(ResultCode.RESUME_REVIEW_DISABLED.getCode(), contactCode.getCode());
        assertEquals(ResultCode.RESUME_REVIEW_DISABLED.getCode(), create.getCode());
        assertEquals(ResultCode.RESUME_REVIEW_DISABLED.getCode(), retryMail.getCode());
        verifyNoInteractions(verificationCodeService, mailService, uploadService, outboxMapper);
        verify(requestMapper, never()).selectIdempotent(anyLong(), anyString());
        verify(requestMapper, never()).selectByRequestNoForUpdate(anyString());
    }

    @Test
    void firstRequestIsWelcomeFreeEvenWhenPaidChannelIsClosed() {
        PlatformConfig config = new PlatformConfig();
        config.setResumeReviewPriceCents(0);
        when(platformConfigService.getConfigEntity()).thenReturn(config);

        var eligibility = service.eligibility(7L);

        assertTrue(eligibility.isEnabled());
        assertTrue(eligibility.isWelcomeFreeAvailable());
        assertEquals("WELCOME_FREE", eligibility.getNextEntitlement());
        assertFalse(eligibility.isPaidReviewAvailable());
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
    void bindingAnotherLoginMethodKeepsTheExistingQuotaSubject() {
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
        PlatformConfig config = new PlatformConfig();
        config.setResumeReviewPriceCents(0);
        when(platformConfigService.getConfigEntity()).thenReturn(config);

        service.eligibility(7L);

        verify(ledgerMapper).selectActiveEntitlement("WELCOME:canonical-subject");
    }

    @Test
    void eligibilityRoutesSecondAndLaterRequestsDirectlyToPayment() {
        when(ledgerMapper.selectActiveEntitlement(startsWith("WELCOME:")))
                .thenReturn(new ResumeReviewCreditLedger());
        PlatformConfig config = new PlatformConfig();
        config.setResumeReviewPriceCents(8800);
        when(platformConfigService.getConfigEntity()).thenReturn(config);
        when(paymentGateway.provider()).thenReturn("wechat");
        properties.setPaidAcceptNewOrders(true);

        var eligibility = service.eligibility(7L);

        assertFalse(eligibility.isWelcomeFreeAvailable());
        assertTrue(eligibility.isPaidReviewAvailable());
        assertEquals("PAID", eligibility.getNextEntitlement());
        assertEquals(8800, eligibility.getPriceCents());
    }

    @Test
    void secondRequestCreatesAnIndependentPaidOrder() {
        when(ledgerMapper.selectActiveEntitlement(startsWith("WELCOME:")))
                .thenReturn(new ResumeReviewCreditLedger());
        PlatformConfig config = new PlatformConfig();
        config.setResumeReviewPriceCents(8800);
        when(platformConfigService.getConfigEntity()).thenReturn(config);
        User user = new User();
        user.setId(7L);
        user.setStatus(1);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(paymentGateway.provider()).thenReturn("wechat");
        when(verificationCodeService.consumeResumeReviewContactCode(
                "contact@example.net", "123456"))
                .thenReturn(VerificationCodeService.ConsumeResult.VERIFIED);
        when(paymentGateway.createNativeOrder(any())).thenReturn(new PaymentPrepayResult(
                "wechat", "prepay-1", "weixin://wxpay/bizpayurl?pr=test",
                LocalDateTime.now().plusMinutes(30)));
        when(qrCodeGenerator.generate(anyString())).thenReturn("data:image/png;base64,test");
        properties.setPaidAcceptNewOrders(true);

        var created = service.create(7L, createDto(), "127.0.0.1");

        assertEquals("PAID", created.getEntitlementType());
        assertEquals(8800, created.getPriceCents());
        assertEquals("AWAITING_PAYMENT", created.getRequestStatus());
        assertEquals("PENDING", created.getPaymentStatus());
        assertNotNull(created.getOrderNo());
        verify(paymentGateway).createNativeOrder(any());
        verify(uploadService).markConsumed(any(ResumeReviewUpload.class), any());
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
        User user = new User();
        user.setId(7L);
        user.setStatus(1);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);

        var result = service.create(7L, createDto(), "127.0.0.1");

        assertEquals("RR-existing", result.getRequestNo());
        verify(requestMapper, times(2)).selectIdempotent(7L, "idem-1");
        verifyNoInteractions(uploadService, verificationCodeService, paymentGateway);
        verify(requestMapper, never()).insert(any(ResumeReviewRequest.class));
    }

    @Test
    void invalidUploadDoesNotConsumeContactVerificationCode() {
        User user = new User();
        user.setId(7L);
        user.setStatus(1);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(uploadService.requireReadyForCreate(7L, "RU-upload", 1L))
                .thenThrow(new BusinessException(
                        ResultCode.RESUME_REVIEW_UPLOAD_EXPIRED));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.create(7L, createDto(), "127.0.0.1"));

        assertEquals(ResultCode.RESUME_REVIEW_UPLOAD_EXPIRED.getCode(),
                exception.getCode());
        verifyNoInteractions(verificationCodeService);
    }

    @Test
    void secondRequestFailsClosedWhenServerPriceIsZero() {
        when(ledgerMapper.selectActiveEntitlement(startsWith("WELCOME:")))
                .thenReturn(new ResumeReviewCreditLedger());
        PlatformConfig config = new PlatformConfig();
        config.setResumeReviewPriceCents(0);
        when(platformConfigService.getConfigEntity()).thenReturn(config);
        User user = new User();
        user.setId(7L);
        user.setStatus(1);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        properties.setPaidAcceptNewOrders(true);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.create(7L, createDto(), "127.0.0.1"));

        assertEquals(ResultCode.RESUME_REVIEW_PAID_NOT_ENABLED.getCode(), exception.getCode());
        verify(paymentGateway, never()).createNativeOrder(any());
    }

    @Test
    void secondRequestFailsClosedWhenPaidOrderSwitchIsOff() {
        when(ledgerMapper.selectActiveEntitlement(startsWith("WELCOME:")))
                .thenReturn(new ResumeReviewCreditLedger());
        PlatformConfig config = new PlatformConfig();
        config.setResumeReviewPriceCents(8800);
        when(platformConfigService.getConfigEntity()).thenReturn(config);
        User user = new User();
        user.setId(7L);
        user.setStatus(1);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.create(7L, createDto(), "127.0.0.1"));

        assertEquals(ResultCode.RESUME_REVIEW_PAID_NOT_ENABLED.getCode(), exception.getCode());
        verifyNoInteractions(paymentGateway, verificationCodeService, uploadService);
    }

    @Test
    void secondRequestFailsClosedWhenPaymentProviderIsNotWechat() {
        when(ledgerMapper.selectActiveEntitlement(startsWith("WELCOME:")))
                .thenReturn(new ResumeReviewCreditLedger());
        PlatformConfig config = new PlatformConfig();
        config.setResumeReviewPriceCents(8800);
        when(platformConfigService.getConfigEntity()).thenReturn(config);
        User user = new User();
        user.setId(7L);
        user.setStatus(1);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(paymentGateway.provider()).thenReturn("disabled");
        properties.setPaidAcceptNewOrders(true);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.create(7L, createDto(), "127.0.0.1"));

        assertEquals(ResultCode.RESUME_REVIEW_PAID_NOT_ENABLED.getCode(), exception.getCode());
        verify(paymentGateway, never()).createNativeOrder(any());
        verifyNoInteractions(verificationCodeService, uploadService);
    }

    @Test
    void adminReturnAfterSmtpAcceptanceDoesNotRestoreWelcomeCredit() {
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
    void adminReturnBeforeSmtpAcceptanceRestoresReservedWelcomeCredit() {
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
        properties.setEnabled(false);
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
        dto.setUploadNo("RU-upload");
        dto.setIdempotencyKey("idem-1");
        dto.setContactEmail("contact@example.net");
        dto.setVerificationCode("123456");
        dto.setManualReviewConsent(true);
        dto.setEmailDeliveryConsent(true);
        return dto;
    }

}
