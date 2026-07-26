package com.itwanger.pairesume.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.WechatQrAuthProperties;
import com.itwanger.pairesume.dto.TokenDTO;
import com.itwanger.pairesume.dto.UserInfoDTO;
import com.itwanger.pairesume.dto.LegalConsentDTO;
import com.itwanger.pairesume.service.AuthService;
import com.itwanger.pairesume.service.VipInviteClaimService;
import com.itwanger.pairesume.wechat.WechatBridgeSigner;
import com.itwanger.pairesume.wechat.WechatQrGatewayClient;
import com.itwanger.pairesume.wechat.WechatReauthProofStore;
import jakarta.validation.Validation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WechatQrAuthServiceImplTest {

    @Mock private WechatQrGatewayClient gatewayClient;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private HashOperations<String, Object, Object> hashOperations;
    @Mock private ValueOperations<String, String> valueOperations;
    @Mock private AuthService authService;
    @Mock private WechatReauthProofStore reauthProofStore;
    @Mock private VipInviteClaimService vipInviteClaimService;

    private WechatQrAuthProperties properties;
    private WechatBridgeSigner signer;
    private WechatQrAuthServiceImpl service;

    @BeforeEach
    void setUp() {
        properties = new WechatQrAuthProperties();
        properties.setEnabled(true);
        properties.setGatewayBaseUrl("https://paicoding.example.org");
        properties.setBridgeSecret("bridge-secret-that-is-at-least-32-characters");
        properties.setAccountAppId("wx1234567890abcdef");
        properties.setScenePrefix("pr_");
        signer = new WechatBridgeSigner();
        org.mockito.Mockito.lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        service = new WechatQrAuthServiceImpl(
                properties,
                gatewayClient,
                signer,
                redisTemplate,
                new ObjectMapper(),
                Validation.buildDefaultValidatorFactory().getValidator(),
                authService,
                reauthProofStore,
                vipInviteClaimService
        );
    }

    @Test
    void loginChallengeUsesIndependentHighEntropyPollTokenAndTemporaryStringScene() {
        when(valueOperations.increment(any())).thenReturn(1L);
        when(redisTemplate.opsForHash()).thenReturn(hashOperations);
        when(gatewayClient.createTemporaryQr(any(), eq(300))).thenReturn("data:image/png;base64,AA==");
        ArgumentCaptor<String> scene = ArgumentCaptor.forClass(String.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<Object, Object>> state = ArgumentCaptor.forClass(Map.class);

        var challenge = service.createLoginChallenge("203.0.113.8");

        assertTrue(challenge.getChallengeId().matches("[A-Za-z0-9_-]{43}"));
        assertTrue(challenge.getPollToken().matches("[A-Za-z0-9_-]{43}"));
        assertNotEquals(challenge.getChallengeId(), challenge.getPollToken());
        verify(gatewayClient).createTemporaryQr(scene.capture(), eq(300));
        assertEquals("pr_L_" + challenge.getChallengeId(), scene.getValue());
        assertFalse(scene.getValue().contains(challenge.getPollToken()));
        verify(hashOperations).putAll(any(), state.capture());
        assertEquals(signer.sha256(challenge.getPollToken()), state.getValue().get("poll_hash"));
        assertFalse(state.getValue().containsValue(challenge.getPollToken()));
        verify(redisTemplate).expire(any(), eq(300L), eq(TimeUnit.SECONDS));
    }

    @Test
    void loginChallengeCanCarryAHashedDatabaseClaimBindingWithoutExposingClaimTokenToWechat() {
        String claimToken = "T".repeat(43);
        when(valueOperations.increment(any())).thenReturn(1L);
        when(redisTemplate.opsForHash()).thenReturn(hashOperations);
        when(vipInviteClaimService.attachToChallenge(eq(claimToken), any())).thenReturn(91L);
        when(gatewayClient.createTemporaryQr(any(), eq(300))).thenReturn("data:image/png;base64,AA==");
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<Object, Object>> state = ArgumentCaptor.forClass(Map.class);
        ArgumentCaptor<String> scene = ArgumentCaptor.forClass(String.class);

        var challenge = service.createLoginChallenge("203.0.113.8", claimToken);

        verify(vipInviteClaimService).attachToChallenge(claimToken, challenge.getChallengeId());
        verify(hashOperations).putAll(any(), state.capture());
        assertEquals("91", state.getValue().get("vip_claim_id"));
        verify(gatewayClient).createTemporaryQr(scene.capture(), eq(300));
        assertFalse(scene.getValue().contains(claimToken));
    }

    @Test
    void signedScanConfirmsSubscriptionButDoesNotExposeOpenIdToBrowser() throws Exception {
        when(valueOperations.setIfAbsent(any(), eq("PROCESSING"), any(java.time.Duration.class)))
                .thenReturn(true);
        doReturn(1L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));
        String timestamp = String.valueOf(Instant.now().getEpochSecond());
        String nonce = "nonce_0123456789abcdef";
        byte[] body = new ObjectMapper().writeValueAsBytes(Map.of(
                "appId", properties.getAccountAppId(),
                "eventType", "scan",
                "openId", "openid_1234567890",
                "scene", "pr_L_" + "A".repeat(43)
        ));
        String signature = signer.sign(properties.getBridgeSecret(), timestamp, nonce, body);

        service.handleBridgeEvent(timestamp, nonce, signature, body);

        verify(authService).recordPaicongmingSubscription(
                eq(properties.getAccountAppId()), eq("openid_1234567890"), eq(true), any()
        );
        verify(redisTemplate).execute(any(RedisScript.class), anyList(), any(Object[].class));
    }

    @Test
    void firstSubscribeAcceptsWechatQrscenePrefixAndConfirmsLoginChallenge() throws Exception {
        when(valueOperations.setIfAbsent(any(), eq("PROCESSING"), any(java.time.Duration.class)))
                .thenReturn(true);
        doReturn(1L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));
        String timestamp = String.valueOf(Instant.now().getEpochSecond());
        String nonce = "nonce_subscribe_0123456789";
        byte[] body = new ObjectMapper().writeValueAsBytes(Map.of(
                "appId", properties.getAccountAppId(),
                "eventType", "subscribe",
                "openId", "openid_first_follow_123",
                "scene", "qrscene_pr_L_" + "C".repeat(43)
        ));

        service.handleBridgeEvent(
                timestamp,
                nonce,
                signer.sign(properties.getBridgeSecret(), timestamp, nonce, body),
                body
        );

        verify(authService).recordPaicongmingSubscription(
                eq(properties.getAccountAppId()), eq("openid_first_follow_123"), eq(true), any()
        );
        verify(redisTemplate).execute(
                any(RedisScript.class),
                eq(java.util.List.of("auth:wechat:challenge:" + "C".repeat(43))),
                eq("LOGIN"),
                eq(properties.getAccountAppId() + ":openid_first_follow_123"),
                any(String.class)
        );
    }

    @Test
    void unsubscribeOnlyUpdatesSubscriptionAndNeverConfirmsAChallenge() throws Exception {
        when(valueOperations.setIfAbsent(any(), eq("PROCESSING"), any(java.time.Duration.class)))
                .thenReturn(true);
        String timestamp = String.valueOf(Instant.now().getEpochSecond());
        String nonce = "nonce_unsubscribe_01234567";
        byte[] body = new ObjectMapper().writeValueAsBytes(Map.of(
                "appId", properties.getAccountAppId(),
                "eventType", "unsubscribe",
                "openId", "openid_unfollow_123",
                "scene", "pr_L_" + "D".repeat(43)
        ));

        service.handleBridgeEvent(
                timestamp,
                nonce,
                signer.sign(properties.getBridgeSecret(), timestamp, nonce, body),
                body
        );

        verify(authService).recordPaicongmingSubscription(
                eq(properties.getAccountAppId()), eq("openid_unfollow_123"), eq(false), any()
        );
        verify(redisTemplate, never()).execute(
                any(RedisScript.class), anyList(), any(Object[].class)
        );
    }

    @Test
    void invalidSignatureIsRejectedBeforeReplayOrIdentityMutation() {
        String timestamp = String.valueOf(Instant.now().getEpochSecond());
        byte[] body = "{}".getBytes(StandardCharsets.UTF_8);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.handleBridgeEvent(
                        timestamp, "nonce_0123456789abcdef", "0".repeat(64), body
                )
        );

        assertEquals(ResultCode.WECHAT_BRIDGE_SIGNATURE_INVALID.getCode(), exception.getCode());
        verify(valueOperations, never()).setIfAbsent(any(), any(), any(java.time.Duration.class));
        verify(authService, never()).recordPaicongmingSubscription(any(), any(), any(Boolean.class), any());
    }

    @Test
    void replayedSignedEventIsAcknowledgedWithoutSecondMutation() throws Exception {
        when(valueOperations.setIfAbsent(any(), eq("PROCESSING"), any(java.time.Duration.class)))
                .thenReturn(false);
        String timestamp = String.valueOf(Instant.now().getEpochSecond());
        String nonce = "nonce_0123456789abcdef";
        byte[] body = new ObjectMapper().writeValueAsBytes(Map.of(
                "appId", properties.getAccountAppId(),
                "eventType", "scan",
                "openId", "openid_1234567890",
                "scene", "pr_L_" + "A".repeat(43)
        ));

        service.handleBridgeEvent(
                timestamp,
                nonce,
                signer.sign(properties.getBridgeSecret(), timestamp, nonce, body),
                body
        );

        verify(authService, never()).recordPaicongmingSubscription(any(), any(), any(Boolean.class), any());
    }

    @Test
    void transientBridgeFailureReleasesReplayGuardSoSignedRetryCanSucceed() throws Exception {
        when(valueOperations.setIfAbsent(
                any(), eq("PROCESSING"), any(java.time.Duration.class)
        )).thenReturn(true);
        doThrow(new IllegalStateException("temporary database failure"))
                .doNothing()
                .when(authService).recordPaicongmingSubscription(
                        eq(properties.getAccountAppId()),
                        eq("openid_retry_123"),
                        eq(false),
                        any()
                );
        String timestamp = String.valueOf(Instant.now().getEpochSecond());
        String nonce = "nonce_retry_012345678901";
        byte[] body = new ObjectMapper().writeValueAsBytes(Map.of(
                "appId", properties.getAccountAppId(),
                "eventType", "unsubscribe",
                "openId", "openid_retry_123"
        ));
        String signature = signer.sign(properties.getBridgeSecret(), timestamp, nonce, body);
        String replayKey = "auth:wechat:bridge-replay:"
                + signer.sha256(timestamp + ":" + nonce);

        assertThrows(
                IllegalStateException.class,
                () -> service.handleBridgeEvent(timestamp, nonce, signature, body)
        );
        verify(redisTemplate).delete(replayKey);

        service.handleBridgeEvent(timestamp, nonce, signature, body);

        verify(authService, times(2)).recordPaicongmingSubscription(
                eq(properties.getAccountAppId()),
                eq("openid_retry_123"),
                eq(false),
                any()
        );
        verify(valueOperations, times(2)).setIfAbsent(
                eq(replayKey), eq("PROCESSING"), any(java.time.Duration.class)
        );
        verify(valueOperations).set(
                eq(replayKey), eq("DONE"), any(java.time.Duration.class)
        );
    }

    @Test
    void loginExchangeClaimsOnceAndUsesExistingTokenPipeline() {
        String challengeId = "A".repeat(43);
        String pollToken = "B".repeat(43);
        long subscribedAt = Instant.now().toEpochMilli();
        doAnswer(invocation -> {
            RedisScript<?> script = invocation.getArgument(0);
            if (String.class.equals(script.getResultType())) {
                return "OK:wx1234567890abcdef:openid_1234567890:" + subscribedAt;
            }
            return 1L;
        }).when(redisTemplate).execute(any(RedisScript.class), anyList(), any(Object[].class));
        UserInfoDTO info = new UserInfoDTO(
                7L, null, "微信用户", "", "USER", "FREE", null, null,
                false, true, false, false, true, true
        );
        TokenDTO token = new TokenDTO("access", "refresh", 900L, info);
        when(authService.loginOrRegisterPaicongming(
                eq("wx1234567890abcdef"), eq("openid_1234567890"), any()
        )).thenReturn(token);

        TokenDTO result = service.exchangeLoginChallenge(challengeId, pollToken);

        assertEquals("access", result.getAccessToken());
        assertEquals("refresh", result.getRefreshToken());
        verify(authService).loginOrRegisterPaicongming(
                eq("wx1234567890abcdef"), eq("openid_1234567890"), any()
        );
    }

    @Test
    void loginExchangeCanRecordExplicitLegalConsentInTheWechatLoginTransaction() {
        String challengeId = "A".repeat(43);
        String pollToken = "B".repeat(43);
        long subscribedAt = Instant.now().toEpochMilli();
        doAnswer(invocation -> {
            RedisScript<?> script = invocation.getArgument(0);
            if (String.class.equals(script.getResultType())) {
                return "OK:wx1234567890abcdef:openid_1234567890:" + subscribedAt;
            }
            return 1L;
        }).when(redisTemplate).execute(any(RedisScript.class), anyList(), any(Object[].class));
        UserInfoDTO info = new UserInfoDTO(
                7L, null, "微信用户", "", "USER", "FREE", null, null,
                false, false, false, false, true, true
        );
        TokenDTO token = new TokenDTO("access", "refresh", 900L, info);
        when(authService.loginOrRegisterPaicongming(
                eq("wx1234567890abcdef"),
                eq("openid_1234567890"),
                any(),
                eq(true),
                eq(true)
        )).thenReturn(token);
        LegalConsentDTO consent = new LegalConsentDTO();
        consent.setTermsAccepted(true);
        consent.setPrivacyAccepted(true);

        TokenDTO result = service.exchangeLoginChallenge(challengeId, pollToken, consent);

        assertFalse(result.getUserInfo().isLegalConsentRequired());
        verify(authService).loginOrRegisterPaicongming(
                eq("wx1234567890abcdef"),
                eq("openid_1234567890"),
                any(),
                eq(true),
                eq(true)
        );
    }

    @Test
    void partialLegalConsentIsRejectedBeforeTheChallengeIsClaimed() {
        LegalConsentDTO consent = new LegalConsentDTO();
        consent.setTermsAccepted(true);
        consent.setPrivacyAccepted(false);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.exchangeLoginChallenge(
                        "A".repeat(43), "B".repeat(43), consent
                )
        );

        assertEquals(ResultCode.BAD_REQUEST.getCode(), exception.getCode());
        verify(redisTemplate, never()).execute(
                any(RedisScript.class), anyList(), any(Object[].class)
        );
        verify(authService, never()).loginOrRegisterPaicongming(
                any(), any(), any(), any(Boolean.class), any(Boolean.class)
        );
    }

    @Test
    void inviteBindingFailureNeverBlocksAValidWechatLogin() {
        String challengeId = "A".repeat(43);
        String pollToken = "B".repeat(43);
        long subscribedAt = Instant.now().toEpochMilli();
        doAnswer(invocation -> {
            RedisScript<?> script = invocation.getArgument(0);
            if (String.class.equals(script.getResultType())) {
                return "OK:wx1234567890abcdef:openid_1234567890:"
                        + subscribedAt + ":91";
            }
            return 1L;
        }).when(redisTemplate).execute(any(RedisScript.class), anyList(), any(Object[].class));
        UserInfoDTO info = new UserInfoDTO(
                7L, null, "微信用户", "", "USER", "FREE", null, null,
                false, true, false, false, true, true
        );
        TokenDTO token = new TokenDTO("access", "refresh", 900L, info);
        when(authService.loginOrRegisterPaicongming(
                eq("wx1234567890abcdef"), eq("openid_1234567890"), any()
        )).thenReturn(token);
        doThrow(new IllegalStateException("claim database temporarily unavailable"))
                .when(vipInviteClaimService).bindUserAfterLogin(91L, challengeId, 7L);

        TokenDTO result = service.exchangeLoginChallenge(challengeId, pollToken);

        assertEquals("access", result.getAccessToken());
        verify(vipInviteClaimService).bindUserAfterLogin(91L, challengeId, 7L);
    }

    @Test
    void expiredPollHasExplicitNonCredentialBearingState() {
        when(redisTemplate.opsForHash()).thenReturn(hashOperations);
        when(hashOperations.entries(any())).thenReturn(Map.of());

        var result = service.pollLoginChallenge("A".repeat(43), "B".repeat(43));

        assertEquals("EXPIRED", result.getStatus());
        assertEquals(0, result.getExpiresIn());
    }

    @Test
    void consumedChallengeCannotMintAnotherToken() {
        doReturn("ERR:CONSUMED").when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.exchangeLoginChallenge("A".repeat(43), "B".repeat(43))
        );

        assertEquals(ResultCode.WECHAT_CHALLENGE_CONSUMED.getCode(), exception.getCode());
        verify(authService, never()).loginOrRegisterPaicongming(any(), any(), any());
    }

    @Test
    void reauthExchangeVerifiesLinkedIdentityAndIssuesShortLivedProof() {
        String challengeId = "E".repeat(43);
        String pollToken = "F".repeat(43);
        long subscribedAt = Instant.now().toEpochMilli();
        doAnswer(invocation -> {
            RedisScript<?> script = invocation.getArgument(0);
            if (String.class.equals(script.getResultType())) {
                return "OK:wx1234567890abcdef:openid_reauth_123:" + subscribedAt;
            }
            return 1L;
        }).when(redisTemplate).execute(any(RedisScript.class), anyList(), any(Object[].class));
        when(reauthProofStore.issue(7L)).thenReturn("P".repeat(43));

        var result = service.exchangeReauthChallenge(7L, challengeId, pollToken);

        assertEquals("P".repeat(43), result.getReauthProof());
        assertEquals(WechatReauthProofStore.PROOF_TTL_SECONDS, result.getExpiresIn());
        verify(authService).verifyPaicongmingReauth(
                7L, "wx1234567890abcdef", "openid_reauth_123"
        );
        verify(reauthProofStore).issue(7L);
    }
}
