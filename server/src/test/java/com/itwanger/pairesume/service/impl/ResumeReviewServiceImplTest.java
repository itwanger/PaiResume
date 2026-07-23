package com.itwanger.pairesume.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumeReviewProperties;
import com.itwanger.pairesume.dto.CreateResumeReviewRequestDTO;
import com.itwanger.pairesume.entity.*;
import com.itwanger.pairesume.mapper.*;
import com.itwanger.pairesume.payment.MarketplacePaymentGateway;
import com.itwanger.pairesume.payment.QrCodeDataUrlGenerator;
import com.itwanger.pairesume.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResumeReviewServiceImplTest {
    @Mock private ResumeReviewRequestMapper requestMapper;
    @Mock private ResumeReviewCreditLedgerMapper ledgerMapper;
    @Mock private ResumeReviewQuotaIdentityMapper quotaIdentityMapper;
    @Mock private ResumeReviewFollowRewardMapper rewardMapper;
    @Mock private ResumeReviewFollowChallengeMapper challengeMapper;
    @Mock private ResumeReviewFollowFallbackCodeMapper fallbackCodeMapper;
    @Mock private ResumeReviewMailOutboxMapper outboxMapper;
    @Mock private ResumeReviewAuditLogMapper auditMapper;
    @Mock private UserMapper userMapper;
    @Mock private UserAuthIdentityMapper identityMapper;
    @Mock private ResumeService resumeService;
    @Mock private ResumeModuleService moduleService;
    @Mock private PlatformConfigService platformConfigService;
    @Mock private VerificationCodeService verificationCodeService;
    @Mock private MailService mailService;
    @Mock private MarketplacePaymentGateway paymentGateway;
    @Mock private QrCodeDataUrlGenerator qrCodeGenerator;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;

    private ResumeReviewProperties properties;
    private ResumeReviewServiceImpl service;

    @BeforeEach
    void setUp() {
        properties = new ResumeReviewProperties();
        service = new ResumeReviewServiceImpl(requestMapper, ledgerMapper, quotaIdentityMapper, rewardMapper,
                challengeMapper, fallbackCodeMapper, outboxMapper, auditMapper, userMapper,
                identityMapper, resumeService, moduleService, platformConfigService,
                verificationCodeService, mailService, paymentGateway, qrCodeGenerator,
                properties, new ObjectMapper(), redisTemplate);
        UserAuthIdentity identity = new UserAuthIdentity();
        identity.setProvider("WECHAT_SERVICE");
        identity.setPrincipal("wx-app:openid-stable");
        identity.setStatus(1);
        lenient().when(identityMapper.selectList(any())).thenReturn(List.of(identity));
    }

    @Test
    void firstRequestIsWelcomeFreeEvenWhenPaidChannelIsClosed() {
        PlatformConfig config = new PlatformConfig();
        config.setResumeReviewPriceCents(0);
        when(platformConfigService.getConfigEntity()).thenReturn(config);

        var eligibility = service.eligibility(7L);

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
    void secondRequestCannotSkipFollowRewardAndPayDirectly() {
        when(ledgerMapper.selectActiveEntitlement(startsWith("WELCOME:")))
                .thenReturn(new ResumeReviewCreditLedger());
        User user = new User();
        user.setId(7L);
        user.setStatus(1);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        CreateResumeReviewRequestDTO dto = createDto();

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.create(7L, dto, "127.0.0.1"));

        assertEquals(ResultCode.RESUME_REVIEW_FOLLOW_REQUIRED.getCode(), exception.getCode());
        verifyNoInteractions(paymentGateway, verificationCodeService, resumeService);
    }

    @Test
    void thirdRequestFailsClosedWhenServerPriceIsZero() {
        when(ledgerMapper.selectActiveEntitlement(startsWith("WELCOME:")))
                .thenReturn(new ResumeReviewCreditLedger());
        ResumeReviewFollowReward reward = new ResumeReviewFollowReward();
        reward.setId(9L);
        reward.setConsumedRequestId(88L);
        when(rewardMapper.selectBySubjectForUpdate(anyString())).thenReturn(reward);
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
    void invalidFollowBridgeSignatureIsRejectedBeforeReplayStateOrDatabase() {
        enableBridge();
        String body = "{\"openid\":\"o1\",\"eventId\":\"e1\",\"content\":\"简历精修 ABC\"}";

        assertThrows(BusinessException.class, () -> service.handleFollowBridgeEvent(
                String.valueOf(Instant.now().getEpochSecond()), "nonce_1234567890", "00", body));

        verifyNoInteractions(redisTemplate, challengeMapper);
    }

    @Test
    void expiredFollowBridgeEventIsRejectedBeforeReplayState() throws Exception {
        enableBridge();
        String timestamp = String.valueOf(Instant.now().minusSeconds(301).getEpochSecond());
        String nonce = "nonce_1234567890";
        String body = "{}";
        String signature = sign(timestamp, nonce, body);

        assertThrows(BusinessException.class,
                () -> service.handleFollowBridgeEvent(timestamp, nonce, signature, body));

        verifyNoInteractions(redisTemplate, challengeMapper);
    }

    @Test
    void replayedSignedFollowBridgeEventReturnsIdempotentSuccess() throws Exception {
        enableBridge();
        String timestamp = String.valueOf(Instant.now().getEpochSecond());
        String nonce = "nonce_1234567890";
        String body = "{}";
        String signature = sign(timestamp, nonce, body);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(anyString(), eq("1"), any())).thenReturn(false);

        assertDoesNotThrow(
                () -> service.handleFollowBridgeEvent(timestamp, nonce, signature, body));

        verifyNoInteractions(challengeMapper, rewardMapper);
    }

    @Test
    void transientBridgeProcessingFailureReleasesReplayClaimForTrustedRetry() throws Exception {
        enableBridge();
        String timestamp = String.valueOf(Instant.now().getEpochSecond());
        String nonce = "nonce_1234567890";
        String body = "{\"openid\":\"openid_123\",\"eventId\":\"event:123\","
                + "\"content\":\"简历精修 23456789ABCDEFGH\"}";
        String signature = sign(timestamp, nonce, body);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(anyString(), eq("1"), any())).thenReturn(true);
        when(challengeMapper.selectByEventHash(anyString()))
                .thenThrow(new IllegalStateException("temporary database failure"));

        assertThrows(BusinessException.class,
                () -> service.handleFollowBridgeEvent(timestamp, nonce, signature, body));

        verify(redisTemplate).delete(startsWith("resume-review:follow-bridge:replay:"));
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
        verifyNoInteractions(ledgerMapper, rewardMapper);
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
        dto.setIdempotencyKey("idem-1");
        dto.setContactEmail("contact@example.net");
        dto.setVerificationCode("123456");
        dto.setManualReviewConsent(true);
        dto.setEmailDeliveryConsent(true);
        return dto;
    }

    private void enableBridge() {
        properties.setFollowBridgeEnabled(true);
        properties.setFollowBridgeHmacSecret("0123456789abcdef0123456789abcdef");
    }

    private String sign(String timestamp, String nonce, String body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(properties.getFollowBridgeHmacSecret()
                .getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(
                (timestamp + "\n" + nonce + "\n" + body).getBytes(StandardCharsets.UTF_8)));
    }
}
