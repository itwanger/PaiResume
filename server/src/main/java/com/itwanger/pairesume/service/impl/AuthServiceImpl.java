package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.*;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.entity.UserAuthIdentity;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.mapper.UserAuthIdentityMapper;
import com.itwanger.pairesume.security.JwtTokenProvider;
import com.itwanger.pairesume.service.AuthService;
import com.itwanger.pairesume.service.MailService;
import com.itwanger.pairesume.service.LoginRateLimitService;
import com.itwanger.pairesume.service.VerificationCodeService;
import com.itwanger.pairesume.service.VipInviteService;
import com.itwanger.pairesume.util.DateTimeUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class AuthServiceImpl implements AuthService {

    private static final DefaultRedisScript<Long> CONSUME_REFRESH_TOKEN_SCRIPT =
            new DefaultRedisScript<>("""
                    local stored = redis.call('GET', KEYS[1])
                    if stored and stored == ARGV[1] and redis.call('EXISTS', KEYS[4]) == 0 then
                      redis.call('DEL', KEYS[1])
                      redis.call('SREM', KEYS[2], KEYS[1])
                      return 1
                    end
                    local members = redis.call('SMEMBERS', KEYS[2])
                    for _, key in ipairs(members) do
                      redis.call('DEL', key)
                    end
                    redis.call('DEL', KEYS[2])
                    redis.call('SREM', KEYS[3], KEYS[2])
                    redis.call('SET', KEYS[4], '1', 'EX', ARGV[2])
                    return 0
                    """, Long.class);

    private static final DefaultRedisScript<Long> STORE_REFRESH_TOKEN_SCRIPT =
            new DefaultRedisScript<>("""
                    if redis.call('EXISTS', KEYS[4]) == 1 then
                      return 0
                    end
                    redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
                    redis.call('SADD', KEYS[2], KEYS[1])
                    redis.call('EXPIRE', KEYS[2], ARGV[2])
                    redis.call('SADD', KEYS[3], KEYS[2])
                    redis.call('EXPIRE', KEYS[3], ARGV[2])
                    return 1
                    """, Long.class);

    private static final DefaultRedisScript<Long> REVOKE_REFRESH_FAMILY_SCRIPT =
            new DefaultRedisScript<>("""
                    local members = redis.call('SMEMBERS', KEYS[1])
                    for _, key in ipairs(members) do
                      redis.call('DEL', key)
                    end
                    redis.call('DEL', KEYS[1])
                    redis.call('SREM', KEYS[2], KEYS[1])
                    redis.call('SET', KEYS[3], '1', 'EX', ARGV[1])
                    return #members
                    """, Long.class);

    private final UserMapper userMapper;
    private final UserAuthIdentityMapper userAuthIdentityMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final StringRedisTemplate redisTemplate;
    private final MailService mailService;
    private final VerificationCodeService verificationCodeService;
    private final LoginRateLimitService loginRateLimitService;
    private final VipInviteService vipInviteService;

    @Value("${jwt.access-token-expiration}")
    private long accessTokenExpiration;

    @Value("${jwt.refresh-token-expiration}")
    private long refreshTokenExpiration;

    public AuthServiceImpl(UserMapper userMapper, UserAuthIdentityMapper userAuthIdentityMapper,
                           PasswordEncoder passwordEncoder, JwtTokenProvider jwtTokenProvider,
                           StringRedisTemplate redisTemplate, MailService mailService,
                           VerificationCodeService verificationCodeService,
                           LoginRateLimitService loginRateLimitService,
                           VipInviteService vipInviteService) {
        this.userMapper = userMapper;
        this.userAuthIdentityMapper = userAuthIdentityMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.redisTemplate = redisTemplate;
        this.mailService = mailService;
        this.verificationCodeService = verificationCodeService;
        this.loginRateLimitService = loginRateLimitService;
        this.vipInviteService = vipInviteService;
    }

    @Override
    @Transactional
    public TokenDTO register(RegisterDTO dto, String clientIp) {
        String normalizedEmail = normalizeEmail(dto.getEmail());

        var verificationResult = verificationCodeService.consumeRegistrationCode(
                normalizedEmail,
                dto.getVerificationCode()
        );
        if (verificationResult == VerificationCodeService.ConsumeResult.ATTEMPTS_EXCEEDED) {
            throw new BusinessException(ResultCode.VERIFY_CODE_ATTEMPTS_EXCEEDED);
        }
        if (verificationResult != VerificationCodeService.ConsumeResult.VERIFIED) {
            throw new BusinessException(ResultCode.VERIFY_CODE_ERROR);
        }

        var exists = userMapper.selectCount(
                new LambdaQueryWrapper<User>().eq(User::getEmail, normalizedEmail)
        );
        if (exists > 0) {
            throw new BusinessException(ResultCode.EMAIL_EXISTS);
        }

        var user = new User();
        try {
            user.setEmail(normalizedEmail);
            user.setPassword(passwordEncoder.encode(dto.getPassword()));
            user.setNickname("");
            user.setAvatar("");
            user.setRole(0);
            user.setStatus(1);
            user.setMembershipStatus("FREE");
            userMapper.insert(user);

            var identity = new UserAuthIdentity();
            identity.setUserId(user.getId());
            identity.setProvider("EMAIL_PASSWORD");
            identity.setPrincipal(normalizedEmail);
            identity.setCredentialHash(user.getPassword());
            identity.setVerifiedAt(LocalDateTime.now());
            identity.setStatus(1);
            userAuthIdentityMapper.insert(identity);
        } catch (DuplicateKeyException exception) {
            throw new BusinessException(ResultCode.EMAIL_EXISTS);
        }

        if (StringUtils.hasText(dto.getInviteCode())) {
            vipInviteService.redeem(user.getId(), dto.getInviteCode(), clientIp);
            user = userMapper.selectById(user.getId());
            if (user == null) {
                throw new BusinessException(ResultCode.USER_NOT_FOUND);
            }
        }

        return generateTokenPair(user);
    }

    @Override
    public TokenDTO login(LoginDTO dto, String clientIp) {
        String normalizedEmail = normalizeEmail(dto.getEmail());
        loginRateLimitService.acquireAttempt(normalizedEmail, clientIp);
        var identity = userAuthIdentityMapper.selectOne(
            new LambdaQueryWrapper<UserAuthIdentity>()
                .eq(UserAuthIdentity::getProvider, "EMAIL_PASSWORD")
                .eq(UserAuthIdentity::getPrincipal, normalizedEmail)
                .eq(UserAuthIdentity::getStatus, 1)
                .last("LIMIT 1")
        );

        if (identity == null || identity.getCredentialHash() == null
                || !passwordEncoder.matches(dto.getPassword(), identity.getCredentialHash())) {
            throw new BusinessException(ResultCode.LOGIN_FAILED);
        }

        var user = userMapper.selectById(identity.getUserId());
        if (user == null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        if (user.getStatus() == 0) {
            throw new BusinessException(ResultCode.ACCOUNT_LOCKED);
        }

        identity.setLastLoginAt(LocalDateTime.now());
        userAuthIdentityMapper.updateById(identity);
        loginRateLimitService.recordSuccess(normalizedEmail);
        return generateTokenPair(user);
    }

    @Override
    public TokenDTO refreshToken(String refreshToken) {
        if (!jwtTokenProvider.validateRefreshToken(refreshToken)) {
            throw new BusinessException(ResultCode.REFRESH_TOKEN_INVALID);
        }

        var userId = jwtTokenProvider.getUserIdFromToken(refreshToken);
        var jti = jwtTokenProvider.getJtiFromToken(refreshToken);
        var sessionId = jwtTokenProvider.getSessionIdFromToken(refreshToken);

        Long consumed = redisTemplate.execute(
                CONSUME_REFRESH_TOKEN_SCRIPT,
                List.of(
                        refreshTokenKey(userId, jti),
                        refreshFamilyKey(userId, sessionId),
                        refreshUserIndexKey(userId),
                        refreshRevokedFamilyKey(userId, sessionId)
                ),
                tokenDigest(refreshToken),
                String.valueOf(refreshTokenTtlSeconds())
        );
        if (consumed == null || consumed != 1L) {
            throw new BusinessException(ResultCode.REFRESH_TOKEN_EXPIRED);
        }

        // 获取用户信息生成新 token
        var user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        if (user.getStatus() == null || user.getStatus() == 0) {
            revokeRefreshFamily(userId, sessionId);
            throw new BusinessException(ResultCode.ACCOUNT_LOCKED);
        }

        return generateTokenPair(user, sessionId);
    }

    @Override
    public UserInfoDTO getCurrentUserInfo(Long userId) {
        var user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        return buildUserInfo(user);
    }

    @Override
    public void logout(Long userId, String accessToken) {
        var jti = jwtTokenProvider.getJtiFromToken(accessToken);
        var expiration = jwtTokenProvider.getExpirationFromToken(accessToken);

        // 将 access token 加入黑名单
        var remainingSeconds = (expiration.getTime() - System.currentTimeMillis()) / 1000;
        if (remainingSeconds > 0) {
            redisTemplate.opsForValue().set("blacklist:" + jti, "1", remainingSeconds, TimeUnit.SECONDS);
        }

        revokeRefreshFamily(userId, jwtTokenProvider.getSessionIdFromToken(accessToken));
    }

    @Override
    public void sendVerificationCode(String email, String clientIp) {
        String normalizedEmail = normalizeEmail(email);
        String code = verificationCodeService.issueRegistrationCode(normalizedEmail, clientIp);
        try {
            mailService.sendVerificationCode(normalizedEmail, code);
        } catch (RuntimeException exception) {
            verificationCodeService.rollbackRegistrationCode(normalizedEmail);
            throw exception;
        }
        log.info("Registration verification email accepted for delivery to {}", maskEmail(normalizedEmail));
    }

    private TokenDTO generateTokenPair(User user) {
        return generateTokenPair(user, UUID.randomUUID().toString());
    }

    private TokenDTO generateTokenPair(User user, String sessionId) {
        var role = user.getRole() == 1 ? "ADMIN" : "USER";
        var accessToken = jwtTokenProvider.generateAccessToken(
                user.getId(), user.getEmail(), role, sessionId
        );
        var refreshToken = jwtTokenProvider.generateRefreshToken(user.getId(), sessionId);

        var refreshJti = jwtTokenProvider.getJtiFromToken(refreshToken);
        Long stored = redisTemplate.execute(
                STORE_REFRESH_TOKEN_SCRIPT,
                List.of(
                        refreshTokenKey(user.getId(), refreshJti),
                        refreshFamilyKey(user.getId(), sessionId),
                        refreshUserIndexKey(user.getId()),
                        refreshRevokedFamilyKey(user.getId(), sessionId)
                ),
                tokenDigest(refreshToken),
                String.valueOf(refreshTokenTtlSeconds())
        );
        if (stored == null || stored != 1L) {
            throw new BusinessException(ResultCode.REFRESH_TOKEN_INVALID);
        }

        var userInfo = buildUserInfo(user);
        return new TokenDTO(accessToken, refreshToken, accessTokenExpiration / 1000, userInfo);
    }

    private UserInfoDTO buildUserInfo(User user) {
        var role = user.getRole() != null && user.getRole() == 1 ? "ADMIN" : "USER";
        return new UserInfoDTO(
                user.getId(),
                user.getEmail(),
                user.getNickname(),
                user.getAvatar(),
                role,
                resolveMembershipStatus(user),
                DateTimeUtils.format(user.getMembershipGrantedAt()),
                DateTimeUtils.format(user.getMembershipExpiresAt()),
                "ADMIN".equals(role)
        );
    }

    private String resolveMembershipStatus(User user) {
        if (!"ACTIVE".equals(user.getMembershipStatus())) {
            return "FREE";
        }
        return user.getMembershipExpiresAt() == null
                || user.getMembershipExpiresAt().isAfter(LocalDateTime.now())
                ? "ACTIVE"
                : "FREE";
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private String maskEmail(String email) {
        int atIndex = email.indexOf('@');
        if (atIndex <= 1) {
            return "***";
        }
        return email.charAt(0) + "***" + email.substring(atIndex);
    }

    private void revokeRefreshFamily(Long userId, String sessionId) {
        redisTemplate.execute(
                REVOKE_REFRESH_FAMILY_SCRIPT,
                List.of(
                        refreshFamilyKey(userId, sessionId),
                        refreshUserIndexKey(userId),
                        refreshRevokedFamilyKey(userId, sessionId)
                ),
                String.valueOf(refreshTokenTtlSeconds())
        );
    }

    private long refreshTokenTtlSeconds() {
        return Math.max(1L, (refreshTokenExpiration + 999L) / 1000L);
    }

    private String tokenDigest(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private String refreshTokenKey(Long userId, String jti) {
        return "refresh:token:" + userId + ":" + jti;
    }

    private String refreshFamilyKey(Long userId, String sessionId) {
        return "refresh:family:" + userId + ":" + sessionId;
    }

    private String refreshUserIndexKey(Long userId) {
        return "refresh:user:" + userId;
    }

    private String refreshRevokedFamilyKey(Long userId, String sessionId) {
        return "refresh:revoked:" + userId + ":" + sessionId;
    }
}
