package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.service.LoginRateLimitService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

@Service
public class LoginRateLimitServiceImpl implements LoginRateLimitService {

    private static final DefaultRedisScript<Long> ACQUIRE_SCRIPT = new DefaultRedisScript<>("""
            local emailCount = redis.call('INCR', KEYS[1])
            if emailCount == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
            local ipCount = redis.call('INCR', KEYS[2])
            if ipCount == 1 then redis.call('EXPIRE', KEYS[2], ARGV[1]) end
            if emailCount > tonumber(ARGV[2]) or ipCount > tonumber(ARGV[3]) then
              return 0
            end
            return 1
            """, Long.class);

    private final StringRedisTemplate redisTemplate;
    private final int windowSeconds;
    private final int emailAttemptLimit;
    private final int ipAttemptLimit;

    public LoginRateLimitServiceImpl(
            StringRedisTemplate redisTemplate,
            @Value("${app.login-rate-limit.window-seconds:900}") int windowSeconds,
            @Value("${app.login-rate-limit.email-attempt-limit:10}") int emailAttemptLimit,
            @Value("${app.login-rate-limit.ip-attempt-limit:100}") int ipAttemptLimit
    ) {
        this.redisTemplate = redisTemplate;
        this.windowSeconds = windowSeconds;
        this.emailAttemptLimit = emailAttemptLimit;
        this.ipAttemptLimit = ipAttemptLimit;
    }

    @Override
    public void acquireAttempt(String email, String clientIp) {
        Long acquired = redisTemplate.execute(
                ACQUIRE_SCRIPT,
                List.of(emailKey(email), ipKey(clientIp)),
                String.valueOf(windowSeconds),
                String.valueOf(emailAttemptLimit),
                String.valueOf(ipAttemptLimit)
        );
        if (acquired == null || acquired != 1L) {
            throw new BusinessException(ResultCode.LOGIN_TOO_MANY_ATTEMPTS);
        }
    }

    @Override
    public void recordSuccess(String email) {
        redisTemplate.delete(emailKey(email));
    }

    private String emailKey(String email) {
        return "login:attempts:email:" + fingerprint(email);
    }

    private String ipKey(String clientIp) {
        String normalized = clientIp == null || clientIp.isBlank() ? "unknown" : clientIp.trim();
        return "login:attempts:ip:" + fingerprint(normalized);
    }

    private String fingerprint(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).substring(0, 32);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
