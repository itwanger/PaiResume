package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumePhotoOssProperties;
import com.itwanger.pairesume.service.ResumePhotoUploadRateLimitService;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

@Service
public class ResumePhotoUploadRateLimitServiceImpl implements ResumePhotoUploadRateLimitService {
    private static final DefaultRedisScript<Long> ACQUIRE_SCRIPT = new DefaultRedisScript<>("""
            local accountCount = redis.call('INCR', KEYS[1])
            if accountCount == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
            local ipCount = redis.call('INCR', KEYS[2])
            if ipCount == 1 then redis.call('EXPIRE', KEYS[2], ARGV[1]) end
            if accountCount > tonumber(ARGV[2]) or ipCount > tonumber(ARGV[3]) then return 0 end
            return 1
            """, Long.class);

    private final StringRedisTemplate redisTemplate;
    private final ResumePhotoOssProperties properties;

    public ResumePhotoUploadRateLimitServiceImpl(StringRedisTemplate redisTemplate,
                                                 ResumePhotoOssProperties properties) {
        this.redisTemplate = redisTemplate;
        this.properties = properties;
    }

    @Override
    public void acquireAttempt(String action, Long userId, String clientIp) {
        String normalized = action == null ? "" : action.strip().toLowerCase(Locale.ROOT);
        if (!Set.of("authorize", "complete", "access").contains(normalized)) {
            throw new IllegalArgumentException("Unsupported photo upload action");
        }
        Long acquired = redisTemplate.execute(ACQUIRE_SCRIPT, List.of(
                        "resume-photo:" + normalized + ":account:" + fingerprint(String.valueOf(userId)),
                        "resume-photo:" + normalized + ":ip:" + fingerprint(normalizeIp(clientIp))),
                String.valueOf(properties.getRateLimitWindowSeconds()),
                String.valueOf(properties.getAccountAttemptLimit()),
                String.valueOf(properties.getIpAttemptLimit()));
        if (acquired == null || acquired != 1L) {
            throw new BusinessException(ResultCode.RESUME_PHOTO_UPLOAD_RATE_LIMITED);
        }
    }

    private String normalizeIp(String value) {
        return value == null || value.isBlank() ? "unknown" : value.strip();
    }

    private String fingerprint(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).substring(0, 32);
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
