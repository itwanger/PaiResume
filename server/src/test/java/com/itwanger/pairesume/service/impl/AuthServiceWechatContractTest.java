package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.AccountDeletionDTO;
import com.itwanger.pairesume.dto.EmailBindingCodeDTO;
import com.itwanger.pairesume.dto.EmailBindingConfirmDTO;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.entity.UserAuthIdentity;
import com.itwanger.pairesume.mapper.UserAuthIdentityMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.security.LegalConsentPolicy;
import com.itwanger.pairesume.security.JwtTokenProvider;
import com.itwanger.pairesume.service.LoginRateLimitService;
import com.itwanger.pairesume.service.MailService;
import com.itwanger.pairesume.service.VerificationCodeService;
import com.itwanger.pairesume.service.VipInviteService;
import com.itwanger.pairesume.wechat.WechatReauthProofStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceWechatContractTest {

    @Mock private UserMapper userMapper;
    @Mock private UserAuthIdentityMapper identityMapper;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtTokenProvider jwtTokenProvider;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private MailService mailService;
    @Mock private VerificationCodeService verificationCodeService;
    @Mock private LoginRateLimitService loginRateLimitService;
    @Mock private VipInviteService vipInviteService;
    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private WechatReauthProofStore reauthProofStore;
    @Mock private SetOperations<String, String> setOperations;
    @Mock private ValueOperations<String, String> valueOperations;

    @Test
    void qrOnlyRegistrationStoresNoFakeEmailOrPasswordAndRequiresLegalConsent() {
        AuthServiceImpl service = service();
        AtomicReference<UserAuthIdentity> insertedIdentity = new AtomicReference<>();
        when(identityMapper.selectOne(any())).thenAnswer(invocation -> insertedIdentity.get());
        when(userMapper.insert(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(7L);
            return 1;
        });
        when(identityMapper.insert(any(UserAuthIdentity.class))).thenAnswer(invocation -> {
            UserAuthIdentity identity = invocation.getArgument(0);
            identity.setId(11L);
            insertedIdentity.set(identity);
            return 1;
        });
        when(jwtTokenProvider.generateAccessToken(eq(7L), isNull(), eq("USER"), anyString()))
                .thenReturn("access-token");
        when(jwtTokenProvider.generateRefreshToken(eq(7L), anyString())).thenReturn("refresh-token");
        when(jwtTokenProvider.getJtiFromToken("refresh-token")).thenReturn("refresh-jti");
        doReturn(1L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));
        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);

        var token = service.loginOrRegisterPaicongming(
                "wx1234567890abcdef", "openid_1234567890", LocalDateTime.now()
        );

        verify(userMapper).insert(userCaptor.capture());
        assertNull(userCaptor.getValue().getEmail());
        assertNull(userCaptor.getValue().getPassword());
        assertNull(token.getUserInfo().getEmail());
        assertFalse(token.getUserInfo().isEmailLoginEnabled());
        assertTrue(token.getUserInfo().isPaicongmingLinked());
        assertTrue(token.getUserInfo().isPaicongmingSubscribed());
        assertTrue(token.getUserInfo().isLegalConsentRequired());
        verify(passwordEncoder, never()).encode(anyString());
    }

    @Test
    void qrOnlyRegistrationCanRecordCurrentLegalConsentBeforeMintingTokens() {
        AuthServiceImpl service = service();
        AtomicReference<UserAuthIdentity> insertedIdentity = new AtomicReference<>();
        when(identityMapper.selectOne(any())).thenAnswer(invocation -> insertedIdentity.get());
        when(userMapper.insert(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(7L);
            return 1;
        });
        when(identityMapper.insert(any(UserAuthIdentity.class))).thenAnswer(invocation -> {
            UserAuthIdentity identity = invocation.getArgument(0);
            identity.setId(11L);
            insertedIdentity.set(identity);
            return 1;
        });
        when(jwtTokenProvider.generateAccessToken(eq(7L), isNull(), eq("USER"), anyString()))
                .thenReturn("access-token");
        when(jwtTokenProvider.generateRefreshToken(eq(7L), anyString())).thenReturn("refresh-token");
        when(jwtTokenProvider.getJtiFromToken("refresh-token")).thenReturn("refresh-jti");
        doReturn(1L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));
        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);

        var token = service.loginOrRegisterPaicongming(
                "wx1234567890abcdef",
                "openid_1234567890",
                LocalDateTime.now(),
                true,
                true
        );

        verify(userMapper).insert(userCaptor.capture());
        User insertedUser = userCaptor.getValue();
        assertEquals(LegalConsentPolicy.CURRENT_VERSION, insertedUser.getTermsVersion());
        assertEquals(LegalConsentPolicy.CURRENT_VERSION, insertedUser.getPrivacyVersion());
        assertEquals(
                LegalConsentPolicy.CURRENT_VERSION,
                insertedUser.getAiProcessingDisclosureVersion()
        );
        assertNotNull(insertedUser.getTermsAcceptedAt());
        assertEquals(insertedUser.getTermsAcceptedAt(), insertedUser.getPrivacyAcceptedAt());
        assertFalse(token.getUserInfo().isLegalConsentRequired());
    }

    @Test
    void existingWechatAccountCanRefreshCurrentLegalConsentBeforeMintingTokens() {
        AuthServiceImpl service = service();
        User user = qrOnlyUser();
        user.setNickname("微信用户");
        user.setAvatar("");
        user.setRole(0);
        user.setMembershipStatus("FREE");
        UserAuthIdentity identity = new UserAuthIdentity();
        identity.setId(11L);
        identity.setUserId(7L);
        identity.setProvider("WECHAT_SERVICE");
        identity.setPrincipal("wx1234567890abcdef:openid_1234567890");
        identity.setStatus(1);
        identity.setSubscribed(true);
        when(identityMapper.selectOne(any())).thenReturn(identity);
        when(userMapper.selectById(7L)).thenReturn(user);
        when(jwtTokenProvider.generateAccessToken(eq(7L), isNull(), eq("USER"), anyString()))
                .thenReturn("access-token");
        when(jwtTokenProvider.generateRefreshToken(eq(7L), anyString())).thenReturn("refresh-token");
        when(jwtTokenProvider.getJtiFromToken("refresh-token")).thenReturn("refresh-jti");
        doReturn(1L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));

        var token = service.loginOrRegisterPaicongming(
                "wx1234567890abcdef",
                "openid_1234567890",
                LocalDateTime.now(),
                true,
                true
        );

        verify(userMapper).updateById(user);
        assertEquals(LegalConsentPolicy.CURRENT_VERSION, user.getTermsVersion());
        assertEquals(LegalConsentPolicy.CURRENT_VERSION, user.getPrivacyVersion());
        assertEquals(
                LegalConsentPolicy.CURRENT_VERSION,
                user.getAiProcessingDisclosureVersion()
        );
        assertFalse(token.getUserInfo().isLegalConsentRequired());
    }

    @Test
    void partialLegalConsentIsRejectedBeforeWechatAccountLookup() {
        AuthServiceImpl service = service();

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.loginOrRegisterPaicongming(
                        "wx1234567890abcdef",
                        "openid_1234567890",
                        LocalDateTime.now(),
                        true,
                        false
                )
        );

        assertEquals(ResultCode.BAD_REQUEST.getCode(), exception.getCode());
        verify(identityMapper, never()).selectOne(any());
        verify(userMapper, never()).insert(any(User.class));
    }

    @Test
    void existingEmailAccountCanBindOnePaicongmingIdentityWithoutCreatingAnotherUser() {
        AuthServiceImpl service = service();
        User user = new User();
        user.setId(7L);
        user.setEmail("reader@example.com");
        user.setPassword("encoded-password");
        user.setNickname("读者");
        user.setAvatar("");
        user.setRole(0);
        user.setStatus(1);
        user.setMembershipStatus("FREE");
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        AtomicReference<UserAuthIdentity> insertedIdentity = new AtomicReference<>();
        when(identityMapper.selectOne(any())).thenAnswer(invocation -> insertedIdentity.get());
        when(identityMapper.insert(any(UserAuthIdentity.class))).thenAnswer(invocation -> {
            UserAuthIdentity identity = invocation.getArgument(0);
            identity.setId(12L);
            insertedIdentity.set(identity);
            return 1;
        });
        LocalDateTime subscribedAt = LocalDateTime.now();

        var info = service.bindPaicongming(
                7L, "wx1234567890abcdef", "openid_bind_123", subscribedAt
        );

        assertTrue(info.isEmailLoginEnabled());
        assertTrue(info.isPaicongmingLinked());
        assertTrue(info.isPaicongmingSubscribed());
        assertEquals("reader@example.com", info.getEmail());
        assertEquals(7L, insertedIdentity.get().getUserId());
        assertEquals("WECHAT_SERVICE", insertedIdentity.get().getProvider());
        assertEquals(
                "wx1234567890abcdef:openid_bind_123",
                insertedIdentity.get().getPrincipal()
        );
        assertEquals(subscribedAt, insertedIdentity.get().getSubscribedAt());
        verify(userMapper, never()).insert(any(User.class));
    }

    @Test
    void qrOnlyAccountCanRequestEmailBindingCode() {
        AuthServiceImpl service = service();
        when(userMapper.selectById(7L)).thenReturn(qrOnlyUser());
        when(verificationCodeService.issueEmailBindingCode("reader@example.com", "203.0.113.8"))
                .thenReturn("123456");
        EmailBindingCodeDTO dto = new EmailBindingCodeDTO();
        dto.setEmail(" Reader@Example.com ");

        service.requestEmailBinding(7L, dto, "203.0.113.8");

        verify(mailService).sendEmailBindingCode("reader@example.com", "123456");
    }

    @Test
    void qrOnlyAccountCanBindVerifiedEmailAndEnablePasswordLogin() {
        AuthServiceImpl service = service();
        User user = qrOnlyUser();
        user.setNickname("");
        user.setAvatar("");
        user.setRole(0);
        user.setMembershipStatus("FREE");
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(verificationCodeService.consumeEmailBindingCode("reader@example.com", "123456"))
                .thenReturn(VerificationCodeService.ConsumeResult.VERIFIED);
        when(passwordEncoder.encode("reader123")).thenReturn("encoded-password");
        ArgumentCaptor<UserAuthIdentity> identityCaptor = ArgumentCaptor.forClass(UserAuthIdentity.class);
        EmailBindingConfirmDTO dto = new EmailBindingConfirmDTO();
        dto.setEmail("Reader@Example.com");
        dto.setVerificationCode("123456");
        dto.setPassword("reader123");

        var info = service.bindEmail(7L, dto);

        verify(userMapper).updateById(user);
        verify(identityMapper).insert(identityCaptor.capture());
        UserAuthIdentity identity = identityCaptor.getValue();
        assertEquals(7L, identity.getUserId());
        assertEquals("EMAIL_PASSWORD", identity.getProvider());
        assertEquals("reader@example.com", identity.getPrincipal());
        assertEquals("encoded-password", identity.getCredentialHash());
        assertEquals("reader@example.com", info.getEmail());
        assertTrue(info.isEmailLoginEnabled());
        assertFalse(info.isPaicongmingLinked());
    }

    @Test
    void emailAlreadyUsedByAnotherAccountCannotBeBound() {
        AuthServiceImpl service = service();
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(qrOnlyUser());
        when(userMapper.selectCount(any())).thenReturn(1L);
        EmailBindingConfirmDTO dto = new EmailBindingConfirmDTO();
        dto.setEmail("used@example.com");
        dto.setVerificationCode("123456");
        dto.setPassword("reader123");

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.bindEmail(7L, dto)
        );

        assertEquals(ResultCode.EMAIL_IDENTITY_CONFLICT.getCode(), exception.getCode());
        verify(verificationCodeService, never()).consumeEmailBindingCode(anyString(), anyString());
        verify(identityMapper, never()).insert(any(UserAuthIdentity.class));
    }

    @Test
    void qrOnlyAccountDeletionConsumesFreshReauthProofAfterAllBlockersPass() {
        AuthServiceImpl service = service();
        User user = qrOnlyUser();
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(identityMapper.selectOne(any())).thenReturn(null);
        stubDeletionBlockers(false);
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.members(anyString())).thenReturn(Set.of());
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        AccountDeletionDTO dto = qrDeletionRequest();

        service.deleteAccount(7L, dto);

        verify(reauthProofStore).consume(7L, "A".repeat(43));
        verify(jdbcTemplate).update(
                contains("UPDATE `user`"), isNull(), isNull(), eq(7L)
        );
        verify(jdbcTemplate, never()).update(contains("UPDATE feedback_submission"), any(Object[].class));
        verify(jdbcTemplate, never()).update(contains("UPDATE coupon_code"), any(Object[].class));
        verify(jdbcTemplate, never()).update(contains("UPDATE marketplace_listing_report"), any(Object[].class));
        verify(passwordEncoder, never()).encode(anyString());
    }

    @Test
    void accountDeletionBlockerDoesNotConsumeQrReauthProof() {
        AuthServiceImpl service = service();
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(qrOnlyUser());
        when(identityMapper.selectOne(any())).thenReturn(null);
        when(jdbcTemplate.queryForObject(
                contains("membership_payment_order"), eq(Boolean.class), eq(7L)
        )).thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.deleteAccount(7L, qrDeletionRequest())
        );

        assertEquals(ResultCode.ACCOUNT_DELETION_BLOCKED.getCode(), exception.getCode());
        verify(reauthProofStore, never()).consume(any(), anyString());
    }

    @Test
    void reauthMustMatchTheAlreadyLinkedSubscribedIdentity() {
        AuthServiceImpl service = service();
        UserAuthIdentity identity = new UserAuthIdentity();
        identity.setUserId(8L);
        identity.setProvider("WECHAT_SERVICE");
        identity.setPrincipal("wx1234567890abcdef:openid_1234567890");
        identity.setStatus(1);
        identity.setSubscribed(true);
        when(identityMapper.selectOne(any())).thenReturn(identity);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.verifyPaicongmingReauth(
                        7L, "wx1234567890abcdef", "openid_1234567890"
                )
        );

        assertEquals(ResultCode.WECHAT_REAUTH_REQUIRED.getCode(), exception.getCode());
        verify(userMapper, never()).selectById(any());
    }

    private AuthServiceImpl service() {
        AuthServiceImpl service = new AuthServiceImpl(
                userMapper,
                identityMapper,
                passwordEncoder,
                jwtTokenProvider,
                redisTemplate,
                mailService,
                verificationCodeService,
                loginRateLimitService,
                vipInviteService,
                jdbcTemplate,
                reauthProofStore
        );
        ReflectionTestUtils.setField(service, "accessTokenExpiration", 900000L);
        ReflectionTestUtils.setField(service, "refreshTokenExpiration", 604800000L);
        return service;
    }

    private User qrOnlyUser() {
        User user = new User();
        user.setId(7L);
        user.setEmail(null);
        user.setPassword(null);
        user.setStatus(1);
        return user;
    }

    private AccountDeletionDTO qrDeletionRequest() {
        AccountDeletionDTO dto = new AccountDeletionDTO();
        dto.setConfirmation("注销账号");
        dto.setWechatReauthProof("A".repeat(43));
        return dto;
    }

    private void stubDeletionBlockers(boolean blocked) {
        when(jdbcTemplate.queryForObject(
                contains("membership_payment_order"), eq(Boolean.class), eq(7L)
        )).thenReturn(blocked);
        when(jdbcTemplate.queryForObject(
                contains("resume_view_order"), eq(Boolean.class), eq(7L), eq(7L)
        )).thenReturn(false);
        when(jdbcTemplate.queryForObject(
                contains("resume_review_request"), eq(Boolean.class), eq(7L)
        )).thenReturn(false);
        when(jdbcTemplate.queryForObject(
                contains("creator_wallet"), eq(Boolean.class), eq(7L), eq(7L)
        )).thenReturn(false);
    }
}
