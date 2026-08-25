package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumeReviewUploadRateLimitProperties;
import com.itwanger.pairesume.service.ResumeReviewUploadRateLimitService;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

@Service
public class ResumeReviewUploadRateLimitServiceImpl
        implements ResumeReviewUploadRateLimitService {
    private static final DefaultRedisScript<Long> ACQUIRE_SCRIPT =
            new DefaultRedisScript<>("""
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

    public ResumeReviewUploadRateLimitServiceImpl(
            StringRedisTemplate redisTemplate,
            ResumeReviewUploadRateLimitProperties properties
    ) {
        this.redisTemplate = redisTemplate;
        this.windowSeconds = properties.getWindowSeconds();
        this.accountAttemptLimit = properties.getAccountAttemptLimit();
        this.ipAttemptLimit = properties.getIpAttemptLimit();
    }

    @Override
    public void acquireAttempt(String action, Long userId, String clientIp) {
        String normalizedAction = normalizeAction(action);
        Long acquired = redisTemplate.execute(
                ACQUIRE_SCRIPT,
                List.of(
                        "resume-review-upload:attempts:" + normalizedAction
                                + ":account:" + fingerprint(String.valueOf(userId)),
                        "resume-review-upload:attempts:" + normalizedAction
                                + ":ip:" + fingerprint(normalizeIp(clientIp))
                ),
                String.valueOf(windowSeconds),
                String.valueOf(accountAttemptLimit),
                String.valueOf(ipAttemptLimit)
        );
        if (acquired == null || acquired != 1L) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_RATE_LIMITED);
        }
    }

    private String normalizeAction(String action) {
        String normalized = action == null ? "" : action.trim().toLowerCase(Locale.ROOT);
        if (!"authorize".equals(normalized) && !"complete".equals(normalized)
                && !"dispatch".equals(normalized)) {
            throw new IllegalArgumentException("Unsupported resume review upload action");
        }
        return normalized;
    }

    private String normalizeIp(String clientIp) {
        return clientIp == null || clientIp.isBlank() ? "unknown" : clientIp.trim();
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
