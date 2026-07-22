package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.RegisterDTO;
import com.itwanger.pairesume.dto.VipInviteRedemptionDTO;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.UserAuthIdentityMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.security.JwtTokenProvider;
import com.itwanger.pairesume.service.LoginRateLimitService;
import com.itwanger.pairesume.service.MailService;
import com.itwanger.pairesume.service.VerificationCodeService;
import com.itwanger.pairesume.service.VipInviteService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
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

    @Test
    void registrationIsATransactionBoundary() throws Exception {
        var registerMethod = AuthServiceImpl.class.getMethod("register", RegisterDTO.class, String.class);

        assertTrue(registerMethod.isAnnotationPresent(Transactional.class));
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
}
