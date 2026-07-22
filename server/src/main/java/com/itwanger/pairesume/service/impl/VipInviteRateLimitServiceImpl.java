package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.service.VipInviteRateLimitService;
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
public class VipInviteRateLimitServiceImpl implements VipInviteRateLimitService {
    private static final DefaultRedisScript<Long> ACQUIRE_SCRIPT = new DefaultRedisScript<>("""
            local accountCount = redis.call('INCR', KEYS[1])
            if accountCount == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
            local ipCount = redis.call('INCR', KEYS[2])
            if ipCount == 1 then redis.call('EXPIRE', KEYS[2], ARGV[1]) end
            if accountCount > tonumber(ARGV[2]) or ipCount > tonumber(ARGV[3]) then
              return 0
            end
            return 1
            """, Long.class);

    private final StringRedisTemplate redisTemplate;
    private final int windowSeconds;
    private final int accountAttemptLimit;
    private final int ipAttemptLimit;

    public VipInviteRateLimitServiceImpl(
            StringRedisTemplate redisTemplate,
            @Value("${app.vip-invite-rate-limit.window-seconds:900}") int windowSeconds,
            @Value("${app.vip-invite-rate-limit.account-attempt-limit:5}") int accountAttemptLimit,
            @Value("${app.vip-invite-rate-limit.ip-attempt-limit:50}") int ipAttemptLimit
    ) {
        this.redisTemplate = redisTemplate;
        this.windowSeconds = windowSeconds;
        this.accountAttemptLimit = accountAttemptLimit;
        this.ipAttemptLimit = ipAttemptLimit;
    }

    @Override
    public void acquireAttempt(String email, String clientIp) {
        Long acquired = redisTemplate.execute(
                ACQUIRE_SCRIPT,
                List.of(accountKey(email), ipKey(clientIp)),
                String.valueOf(windowSeconds),
                String.valueOf(accountAttemptLimit),
                String.valueOf(ipAttemptLimit)
        );
        if (acquired == null || acquired != 1L) {
            throw new BusinessException(ResultCode.VIP_INVITE_RATE_LIMITED);
        }
    }

    private String accountKey(String email) {
        return "vip-invite:attempts:account:" + fingerprint(email == null ? "unknown" : email.trim().toLowerCase());
    }

    private String ipKey(String clientIp) {
        return "vip-invite:attempts:ip:" + fingerprint(clientIp == null || clientIp.isBlank() ? "unknown" : clientIp.trim());
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
