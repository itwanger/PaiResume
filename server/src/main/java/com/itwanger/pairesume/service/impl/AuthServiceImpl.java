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
import com.itwanger.pairesume.util.DateTimeUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class AuthServiceImpl implements AuthService {

    private final UserMapper userMapper;
    private final UserAuthIdentityMapper userAuthIdentityMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final StringRedisTemplate redisTemplate;
    private final MailService mailService;

    @Value("${jwt.access-token-expiration}")
    private long accessTokenExpiration;

    public AuthServiceImpl(UserMapper userMapper, UserAuthIdentityMapper userAuthIdentityMapper,
                           PasswordEncoder passwordEncoder, JwtTokenProvider jwtTokenProvider,
                           StringRedisTemplate redisTemplate, MailService mailService) {
        this.userMapper = userMapper;
        this.userAuthIdentityMapper = userAuthIdentityMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.redisTemplate = redisTemplate;
        this.mailService = mailService;
    }

    @Override
    public TokenDTO register(RegisterDTO dto) {
        String normalizedEmail = normalizeEmail(dto.getEmail());

        // 检查邮箱是否已注册
        var exists = userMapper.selectCount(
            new LambdaQueryWrapper<User>().eq(User::getEmail, normalizedEmail)
        );
        if (exists > 0) {
            throw new BusinessException(ResultCode.EMAIL_EXISTS);
        }

        // 校验验证码
        if (!verifyCode(normalizedEmail, dto.getVerificationCode())) {
            throw new BusinessException(ResultCode.VERIFY_CODE_ERROR);
        }

        // 创建用户
        var user = new User();
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

        // 删除已使用的验证码
        redisTemplate.delete("verify:" + normalizedEmail);

        return generateTokenPair(user);
    }

    @Override
    public TokenDTO login(LoginDTO dto) {
        String normalizedEmail = normalizeEmail(dto.getEmail());
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
        return generateTokenPair(user);
    }

    @Override
    public TokenDTO refreshToken(String refreshToken) {
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            throw new BusinessException(ResultCode.REFRESH_TOKEN_INVALID);
        }

        var userId = jwtTokenProvider.getUserIdFromToken(refreshToken);
        var jti = jwtTokenProvider.getJtiFromToken(refreshToken);

        // 检查 refresh token 是否在 Redis 中
        var storedToken = redisTemplate.opsForValue().get("refresh:" + userId + ":" + jti);
        if (storedToken == null) {
            throw new BusinessException(ResultCode.REFRESH_TOKEN_EXPIRED);
        }

        // 删除旧的 refresh token
        redisTemplate.delete("refresh:" + userId + ":" + jti);

        // 获取用户信息生成新 token
        var user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }

        return generateTokenPair(user);
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

        // 删除 refresh token（通过模式匹配）
        var keys = redisTemplate.keys("refresh:" + userId + ":*");
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
    }

    @Override
    public void sendVerificationCode(String email) {
        String normalizedEmail = normalizeEmail(email);
        // 检查发送频率（60 秒内只能发一次）
        var lastSent = redisTemplate.opsForValue().get("rate:" + normalizedEmail);
        if (lastSent != null) {
            throw new BusinessException(ResultCode.SEND_CODE_TOO_FREQUENT);
        }

        // 生成 6 位验证码
        var code = String.format("%06d", (int) (Math.random() * 1000000));

        // 存储验证码到 Redis（5 分钟有效）
        redisTemplate.opsForValue().set("verify:" + normalizedEmail, code, 5, TimeUnit.MINUTES);

        // 设置发送频率限制（60 秒）
        redisTemplate.opsForValue().set("rate:" + normalizedEmail, "1", 60, TimeUnit.SECONDS);

        mailService.sendVerificationCode(normalizedEmail, code);
        log.info("验证码已发送到 {}: {}", normalizedEmail, code);
    }

    @Override
    public boolean verifyCode(String email, String code) {
        var storedCode = redisTemplate.opsForValue().get("verify:" + normalizeEmail(email));
        return code.equals(storedCode);
    }

    private TokenDTO generateTokenPair(User user) {
        var role = user.getRole() == 1 ? "ADMIN" : "USER";
        var accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), role);
        var refreshToken = jwtTokenProvider.generateRefreshToken(user.getId());

        // 存储 refresh token 到 Redis（7 天有效）
        var refreshJti = jwtTokenProvider.getJtiFromToken(refreshToken);
        redisTemplate.opsForValue().set(
            "refresh:" + user.getId() + ":" + refreshJti,
            refreshToken, 7, TimeUnit.DAYS
        );

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
                user.getMembershipStatus() == null ? "FREE" : user.getMembershipStatus(),
                DateTimeUtils.format(user.getMembershipGrantedAt()),
                "ADMIN".equals(role)
        );
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}
