package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.RegisterDTO;
import com.itwanger.pairesume.dto.PasswordResetConfirmDTO;
import com.itwanger.pairesume.dto.AccountDeletionDTO;
import com.itwanger.pairesume.dto.AccountProfileUpdateDTO;
import com.itwanger.pairesume.dto.LegalConsentDTO;
import com.itwanger.pairesume.dto.ResumePhotoDTO;
import com.itwanger.pairesume.dto.VipInviteRedemptionDTO;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.entity.UserAuthIdentity;
import com.itwanger.pairesume.mapper.UserAuthIdentityMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.security.JwtTokenProvider;
import com.itwanger.pairesume.security.LegalConsentPolicy;
import com.itwanger.pairesume.service.LoginRateLimitService;
import com.itwanger.pairesume.service.MailService;
import com.itwanger.pairesume.service.VerificationCodeService;
import com.itwanger.pairesume.service.VipInviteService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplContractTest {

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
    @Mock private SetOperations<String, String> setOperations;
    @Mock private ValueOperations<String, String> valueOperations;
    @Mock private ResumePhotoService resumePhotoService;

    @Test
    void userCanUpdateNicknameAndOwnedAvatar() {
        var service = new AuthServiceImpl(
                userMapper,
                identityMapper,
                passwordEncoder,
                jwtTokenProvider,
                redisTemplate,
                mailService,
                verificationCodeService,
                loginRateLimitService,
                vipInviteService
        );
        ReflectionTestUtils.setField(service, "resumePhotoService", resumePhotoService);
        User user = new User();
        user.setId(7L);
        user.setEmail("user@example.com");
        user.setNickname("微信用户");
        user.setAvatar("");
        user.setRole(0);
        user.setStatus(1);
        user.setMembershipStatus("FREE");
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(resumePhotoService.storedReference(42L)).thenReturn("resume-photo:42");
        when(resumePhotoService.storedPhotoId("resume-photo:42")).thenReturn(42L);
        when(resumePhotoService.access(7L, 42L)).thenReturn(new ResumePhotoDTO(
                42L, "RP42", "image/jpeg", 1024, 256, 256,
                "https://example.com/avatar.jpg", "2026-08-26 12:00:00"
        ));
        AccountProfileUpdateDTO dto = new AccountProfileUpdateDTO();
        dto.setNickname("  二哥星球成员  ");
        dto.setAvatarPhotoId(42L);

        var result = service.updateProfile(7L, dto);

        assertEquals("二哥星球成员", user.getNickname());
        assertEquals("resume-photo:42", user.getAvatar());
        assertEquals("二哥星球成员", result.getNickname());
        assertEquals(42L, result.getAvatarPhotoId());
        assertEquals("https://example.com/avatar.jpg", result.getAvatar());
        verify(userMapper).updateById(user);
        verify(resumePhotoService, times(2)).access(7L, 42L);
    }

    @Test
    void registrationIsATransactionBoundary() throws Exception {
        var registerMethod = AuthServiceImpl.class.getMethod("register", RegisterDTO.class, String.class);

        assertTrue(registerMethod.isAnnotationPresent(Transactional.class));
    }

    @Test
    void registrationRejectsMissingLegalConsentAtServiceBoundary() {
        var service = new AuthServiceImpl(
                userMapper,
                identityMapper,
                passwordEncoder,
                jwtTokenProvider,
                redisTemplate,
                mailService,
                verificationCodeService,
                loginRateLimitService,
                vipInviteService
        );
        RegisterDTO dto = new RegisterDTO();
        dto.setEmail("user@example.com");
        dto.setPassword("Password123");
        dto.setVerificationCode("123456");

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.register(dto, "127.0.0.1")
        );

        assertEquals(ResultCode.BAD_REQUEST.getCode(), exception.getCode());
        verifyNoInteractions(verificationCodeService, userMapper, identityMapper);
    }

    @Test
    void smtpFailureRollsBackCodeAndCooldown() {
        var service = new AuthServiceImpl(
                userMapper,
                identityMapper,
                passwordEncoder,
                jwtTokenProvider,
                redisTemplate,
                mailService,
                verificationCodeService,
                loginRateLimitService,
                vipInviteService
        );
        when(verificationCodeService.issueRegistrationCode(eq("user@example.com"), eq("127.0.0.1")))
                .thenReturn("123456");
        doThrow(new BusinessException(ResultCode.MAIL_SEND_FAILED))
                .when(mailService).sendVerificationCode("user@example.com", "123456");

        assertThrows(
                BusinessException.class,
                () -> service.sendVerificationCode("user@example.com", "127.0.0.1")
        );

        verify(verificationCodeService).rollbackRegistrationCode("user@example.com");
    }

    @Test
    void sendCodeDoesNotRevealWhetherTheEmailAlreadyExists() {
        var service = new AuthServiceImpl(
                userMapper,
                identityMapper,
                passwordEncoder,
                jwtTokenProvider,
                redisTemplate,
                mailService,
                verificationCodeService,
                loginRateLimitService,
                vipInviteService
        );
        when(verificationCodeService.issueRegistrationCode(eq("user@example.com"), eq("127.0.0.1")))
                .thenReturn("123456");

        service.sendVerificationCode(" User@Example.com ", "127.0.0.1");

        verifyNoInteractions(userMapper);
        verify(mailService).sendVerificationCode("user@example.com", "123456");
    }

    @Test
    void registrationWithInviteReturnsFreshVipStateImmediately() {
        var service = new AuthServiceImpl(
                userMapper,
                identityMapper,
                passwordEncoder,
                jwtTokenProvider,
                redisTemplate,
                mailService,
                verificationCodeService,
                loginRateLimitService,
                vipInviteService
        );
        ReflectionTestUtils.setField(service, "accessTokenExpiration", 900000L);
        ReflectionTestUtils.setField(service, "refreshTokenExpiration", 604800000L);

        RegisterDTO dto = new RegisterDTO();
        dto.setEmail("user@example.com");
        dto.setPassword("Password123");
        dto.setVerificationCode("123456");
        dto.setInviteCode("VIPPLANET12345");
        dto.setTermsAccepted(true);
        dto.setPrivacyAccepted(true);

        when(verificationCodeService.consumeRegistrationCode("user@example.com", "123456"))
                .thenReturn(VerificationCodeService.ConsumeResult.VERIFIED);
        when(userMapper.selectCount(any())).thenReturn(0L);
        when(passwordEncoder.encode("Password123")).thenReturn("password-hash");
        when(userMapper.insert(any(User.class))).thenAnswer(invocation -> {
            User inserted = invocation.getArgument(0);
            inserted.setId(7L);
            return 1;
        });
        when(vipInviteService.redeem(7L, "VIPPLANET12345", "203.0.113.8"))
                .thenReturn(new VipInviteRedemptionDTO(
                        "ACTIVE", "2026-07-22 10:00:00", "2026-08-21 10:00:00", "VIP_INVITE"
                ));
        User activatedUser = new User();
        activatedUser.setId(7L);
        activatedUser.setEmail("user@example.com");
        activatedUser.setNickname("");
        activatedUser.setAvatar("");
        activatedUser.setRole(0);
        activatedUser.setStatus(1);
        activatedUser.setMembershipStatus("ACTIVE");
        activatedUser.setMembershipGrantedAt(java.time.LocalDateTime.now());
        activatedUser.setMembershipExpiresAt(java.time.LocalDateTime.now().plusDays(30));
        activatedUser.setTermsAcceptedAt(LocalDateTime.now());
        activatedUser.setPrivacyAcceptedAt(LocalDateTime.now());
        activatedUser.setTermsVersion(LegalConsentPolicy.CURRENT_VERSION);
        activatedUser.setPrivacyVersion(LegalConsentPolicy.CURRENT_VERSION);
        activatedUser.setAiProcessingDisclosureVersion(LegalConsentPolicy.CURRENT_VERSION);
        when(userMapper.selectById(7L)).thenReturn(activatedUser);
        when(jwtTokenProvider.generateAccessToken(eq(7L), eq("user@example.com"), eq("USER"), any()))
                .thenReturn("access-token");
        when(jwtTokenProvider.generateRefreshToken(eq(7L), any())).thenReturn("refresh-token");
        when(jwtTokenProvider.getJtiFromToken("refresh-token")).thenReturn("refresh-jti");
        doReturn(1L).when(redisTemplate)
                .execute(any(RedisScript.class), anyList(), any(Object[].class));

        var token = service.register(dto, "203.0.113.8");

        assertEquals("ACTIVE", token.getUserInfo().getMembershipStatus());
        assertNotNull(token.getUserInfo().getMembershipExpiresAt());
        verify(vipInviteService).redeem(7L, "VIPPLANET12345", "203.0.113.8");
        verify(userMapper).selectById(7L);
    }

    @Test
    void passwordResetUpdatesBothCredentialStoresAndRevokesOldSessions() {
        var service = new AuthServiceImpl(
                userMapper,
                identityMapper,
                passwordEncoder,
                jwtTokenProvider,
                redisTemplate,
                mailService,
                verificationCodeService,
                loginRateLimitService,
                vipInviteService
        );
        ReflectionTestUtils.setField(service, "accessTokenExpiration", 900000L);

        var dto = new PasswordResetConfirmDTO();
        dto.setEmail(" User@Example.com ");
        dto.setVerificationCode("123456");
        dto.setNewPassword("NewPassword123");

        var identity = new UserAuthIdentity();
        identity.setId(11L);
        identity.setUserId(7L);
        identity.setProvider("EMAIL_PASSWORD");
        identity.setPrincipal("user@example.com");
        identity.setCredentialHash("old-hash");
        identity.setStatus(1);
        var user = new User();
        user.setId(7L);
        user.setStatus(1);
        user.setEmail("user@example.com");

        when(verificationCodeService.consumePasswordResetCode("user@example.com", "123456"))
                .thenReturn(VerificationCodeService.ConsumeResult.VERIFIED);
        when(identityMapper.selectOne(any())).thenReturn(identity);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(passwordEncoder.encode("NewPassword123")).thenReturn("new-hash");
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.members(anyString())).thenReturn(java.util.Set.of());
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        service.resetPassword(dto);

        assertEquals("new-hash", identity.getCredentialHash());
        assertEquals("new-hash", user.getPassword());
        verify(identityMapper).updateById(identity);
        verify(userMapper).updateById(user);
        verify(userMapper).selectByIdForUpdate(7L);
        verify(valueOperations).set(
                eq("auth:credentials-changed:7"),
                anyString(),
                any(java.time.Duration.class)
        );
    }

    @Test
    void passwordResetCannotRaceADeletedAccount() {
        var service = new AuthServiceImpl(
                userMapper,
                identityMapper,
                passwordEncoder,
                jwtTokenProvider,
                redisTemplate,
                mailService,
                verificationCodeService,
                loginRateLimitService,
                vipInviteService
        );
        var dto = new PasswordResetConfirmDTO();
        dto.setEmail("user@example.com");
        dto.setVerificationCode("123456");
        dto.setNewPassword("NewPassword123");
        var identity = new UserAuthIdentity();
        identity.setUserId(7L);
        identity.setStatus(1);
        var deletedUser = new User();
        deletedUser.setId(7L);
        deletedUser.setStatus(0);
        deletedUser.setAccountDeletedAt(LocalDateTime.now());

        when(verificationCodeService.consumePasswordResetCode("user@example.com", "123456"))
                .thenReturn(VerificationCodeService.ConsumeResult.VERIFIED);
        when(identityMapper.selectOne(any())).thenReturn(identity);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(deletedUser);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.resetPassword(dto));

        assertEquals(ResultCode.PASSWORD_RESET_CODE_ERROR.getCode(), exception.getCode());
        verify(identityMapper, never()).updateById(any(UserAuthIdentity.class));
        verify(userMapper, never()).updateById(any(User.class));
        verifyNoInteractions(passwordEncoder);
    }

    @Test
    void legalConsentLocksAccountAndPersistsCurrentVersions() {
        var service = new AuthServiceImpl(
                userMapper,
                identityMapper,
                passwordEncoder,
                jwtTokenProvider,
                redisTemplate,
                mailService,
                verificationCodeService,
                loginRateLimitService,
                vipInviteService
        );
        var user = new User();
        user.setId(7L);
        user.setEmail("user@example.com");
        user.setStatus(1);
        user.setRole(0);
        user.setMembershipStatus("FREE");
        var dto = new LegalConsentDTO();
        dto.setTermsAccepted(true);
        dto.setPrivacyAccepted(true);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);

        var userInfo = service.acceptLegalConsent(7L, dto);

        assertFalse(userInfo.isLegalConsentRequired());
        assertNotNull(user.getTermsAcceptedAt());
        assertNotNull(user.getPrivacyAcceptedAt());
        assertEquals(LegalConsentPolicy.CURRENT_VERSION, user.getTermsVersion());
        assertEquals(LegalConsentPolicy.CURRENT_VERSION, user.getPrivacyVersion());
        assertEquals(LegalConsentPolicy.CURRENT_VERSION, user.getAiProcessingDisclosureVersion());
        verify(userMapper).selectByIdForUpdate(7L);
        verify(userMapper).updateById(user);
    }

    @Test
    void legalConsentCannotReactivateADeletedAccount() {
        var service = new AuthServiceImpl(
                userMapper,
                identityMapper,
                passwordEncoder,
                jwtTokenProvider,
                redisTemplate,
                mailService,
                verificationCodeService,
                loginRateLimitService,
                vipInviteService
        );
        var deletedUser = new User();
        deletedUser.setId(7L);
        deletedUser.setStatus(0);
        deletedUser.setAccountDeletedAt(LocalDateTime.now());
        var dto = new LegalConsentDTO();
        dto.setTermsAccepted(true);
        dto.setPrivacyAccepted(true);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(deletedUser);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.acceptLegalConsent(7L, dto)
        );

        assertEquals(ResultCode.ACCOUNT_ALREADY_DELETED.getCode(), exception.getCode());
        verify(userMapper, never()).updateById(any(User.class));
    }

    @Test
    void passwordResetRequestDoesNotRevealUnknownEmail() {
        var service = new AuthServiceImpl(
                userMapper,
                identityMapper,
                passwordEncoder,
                jwtTokenProvider,
                redisTemplate,
                mailService,
                verificationCodeService,
                loginRateLimitService,
                vipInviteService
        );
        when(identityMapper.selectOne(any())).thenReturn(null);

        assertDoesNotThrow(() -> service.requestPasswordReset("unknown@example.com", "127.0.0.1"));

        verifyNoInteractions(mailService);
        verify(verificationCodeService, never()).issuePasswordResetCode(anyString(), anyString());
    }

    @Test
    void accountDeletionAnonymizesDataAndDisablesEverySession() {
        var service = new AuthServiceImpl(
                userMapper,
                identityMapper,
                passwordEncoder,
                jwtTokenProvider,
                redisTemplate,
                mailService,
                verificationCodeService,
                loginRateLimitService,
                vipInviteService,
                jdbcTemplate
        );

        var user = new User();
        user.setId(7L);
        user.setEmail("user@example.com");
        user.setStatus(1);
        var identity = new UserAuthIdentity();
        identity.setUserId(7L);
        identity.setPrincipal("user@example.com");
        identity.setCredentialHash("old-hash");
        identity.setStatus(1);
        var dto = new AccountDeletionDTO();
        dto.setPassword("Password123");
        dto.setConfirmation("注销账号");

        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(identityMapper.selectOne(any())).thenReturn(identity);
        when(passwordEncoder.matches("Password123", "old-hash")).thenReturn(true);
        when(passwordEncoder.encode(anyString())).thenReturn("disabled-hash");
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.members(anyString())).thenReturn(java.util.Set.of());
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        service.deleteAccount(7L, dto);

        verify(jdbcTemplate).update(contains("sale_closed_at"), eq(7L), eq(7L));
        verify(jdbcTemplate).update(contains("DELETE revision"), eq(7L));
        verify(jdbcTemplate).update(contains("UPDATE feedback_submission"), eq("user@example.com"));
        verify(jdbcTemplate).update(contains("UPDATE coupon_code"), eq("user@example.com"));
        verify(jdbcTemplate).update(contains("UPDATE marketplace_listing_report"), eq("user@example.com"));
        verify(jdbcTemplate).update(contains("DELETE FROM ai_optimize_record"), eq(7L));
        verify(jdbcTemplate).update(contains("DELETE FROM resume_analysis_record"), eq(7L));
        verify(jdbcTemplate).update(contains("UPDATE user_auth_identity"), eq(7L));
        verify(jdbcTemplate).update(argThat(sql -> sql.contains("UPDATE user_auth_identity")
                && !sql.contains("principal =")), eq(7L));
        verify(valueOperations).set("auth:account-disabled:7", "1");
    }

    @Test
    void accountDeletionBlocksUnfinishedMembershipOrder() {
        var service = accountDeletionService();
        stubValidDeletionCredentials();
        when(jdbcTemplate.queryForObject(
                contains("membership_payment_order"), eq(Boolean.class), eq(7L)
        )).thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.deleteAccount(7L, validAccountDeletionRequest())
        );

        assertEquals(ResultCode.ACCOUNT_DELETION_BLOCKED.getCode(), exception.getCode());
        assertTrue(exception.getMessage().contains("会员订单"));
        verify(jdbcTemplate, never()).update(contains("UPDATE `user`"), any(Object[].class));
    }

    @Test
    void accountDeletionBlocksUnfinishedMarketplaceOrder() {
        var service = accountDeletionService();
        stubValidDeletionCredentials();
        when(jdbcTemplate.queryForObject(
                contains("membership_payment_order"), eq(Boolean.class), eq(7L)
        )).thenReturn(false);
        when(jdbcTemplate.queryForObject(
                contains("resume_view_order"), eq(Boolean.class), eq(7L), eq(7L)
        )).thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.deleteAccount(7L, validAccountDeletionRequest())
        );

        assertEquals(ResultCode.ACCOUNT_DELETION_BLOCKED.getCode(), exception.getCode());
        assertTrue(exception.getMessage().contains("简历市场订单"));
        verify(jdbcTemplate, never()).update(contains("UPDATE `user`"), any(Object[].class));
    }

    @Test
    void accountDeletionBlocksUnsettledCreatorBalance() {
        var service = accountDeletionService();
        stubValidDeletionCredentials();
        when(jdbcTemplate.queryForObject(
                contains("membership_payment_order"), eq(Boolean.class), eq(7L)
        )).thenReturn(false);
        when(jdbcTemplate.queryForObject(
                contains("resume_view_order"), eq(Boolean.class), eq(7L), eq(7L)
        )).thenReturn(false);
        when(jdbcTemplate.queryForObject(
                contains("resume_review_request"), eq(Boolean.class), eq(7L)
        )).thenReturn(false);
        when(jdbcTemplate.queryForObject(
                contains("creator_wallet"), eq(Boolean.class), eq(7L), eq(7L)
        )).thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.deleteAccount(7L, validAccountDeletionRequest())
        );

        assertEquals(ResultCode.ACCOUNT_DELETION_BLOCKED.getCode(), exception.getCode());
        assertTrue(exception.getMessage().contains("作者收益"));
        verify(jdbcTemplate, never()).update(contains("UPDATE `user`"), any(Object[].class));
    }

    @Test
    void accountDeletionBlocksActiveResumeReviewDeliveryOrRefund() {
        var service = accountDeletionService();
        stubValidDeletionCredentials();
        when(jdbcTemplate.queryForObject(
                contains("membership_payment_order"), eq(Boolean.class), eq(7L)
        )).thenReturn(false);
        when(jdbcTemplate.queryForObject(
                contains("resume_view_order"), eq(Boolean.class), eq(7L), eq(7L)
        )).thenReturn(false);
        when(jdbcTemplate.queryForObject(
                contains("resume_review_request"), eq(Boolean.class), eq(7L)
        )).thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.deleteAccount(7L, validAccountDeletionRequest())
        );

        assertEquals(ResultCode.ACCOUNT_DELETION_BLOCKED.getCode(), exception.getCode());
        assertTrue(exception.getMessage().contains("人工简历服务"));
        verify(jdbcTemplate, never()).update(contains("UPDATE `user`"), any(Object[].class));
    }

    private AuthServiceImpl accountDeletionService() {
        return new AuthServiceImpl(
                userMapper,
                identityMapper,
                passwordEncoder,
                jwtTokenProvider,
                redisTemplate,
                mailService,
                verificationCodeService,
                loginRateLimitService,
                vipInviteService,
                jdbcTemplate
        );
    }

    private void stubValidDeletionCredentials() {
        var user = new User();
        user.setId(7L);
        user.setEmail("user@example.com");
        user.setStatus(1);
        var identity = new UserAuthIdentity();
        identity.setUserId(7L);
        identity.setPrincipal("user@example.com");
        identity.setCredentialHash("old-hash");
        identity.setStatus(1);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(identityMapper.selectOne(any())).thenReturn(identity);
        when(passwordEncoder.matches("Password123", "old-hash")).thenReturn(true);
    }

    private AccountDeletionDTO validAccountDeletionRequest() {
        var dto = new AccountDeletionDTO();
        dto.setPassword("Password123");
        dto.setConfirmation("注销账号");
        return dto;
    }
}
