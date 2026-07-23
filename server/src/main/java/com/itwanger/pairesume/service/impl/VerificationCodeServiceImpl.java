package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.service.VerificationCodeService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;

@Service
public class VerificationCodeServiceImpl implements VerificationCodeService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private static final DefaultRedisScript<Long> INCREMENT_WITH_TTL_SCRIPT =
            new DefaultRedisScript<>("""
                    local count = redis.call('INCR', KEYS[1])
                    if count == 1 then
                      redis.call('EXPIRE', KEYS[1], ARGV[1])
                    end
                    return count
                    """, Long.class);

    private static final DefaultRedisScript<Long> CONSUME_CODE_SCRIPT =
            new DefaultRedisScript<>("""
                    local stored = redis.call('GET', KEYS[1])
                    if not stored then
                      return -1
                    end
                    if stored == ARGV[1] then
                      redis.call('DEL', KEYS[1])
                      redis.call('DEL', KEYS[2])
                      return 1
                    end
                    local attempts = redis.call('INCR', KEYS[2])
                    if attempts == 1 then
                      redis.call('EXPIRE', KEYS[2], ARGV[3])
                    end
                    if attempts >= tonumber(ARGV[2]) then
                      redis.call('DEL', KEYS[1])
                      return -2
                    end
                    return 0
                    """, Long.class);

    private final StringRedisTemplate redisTemplate;
    private final byte[] codeSecret;
    private final int codeTtlSeconds;
    private final int resendCooldownSeconds;
    private final int maxVerifyAttempts;
    private final int emailHourlyLimit;
    private final int ipHourlyLimit;

    public VerificationCodeServiceImpl(
            StringRedisTemplate redisTemplate,
            @Value("${app.verification-code.secret}") String codeSecret,
            @Value("${app.verification-code.ttl-seconds:300}") int codeTtlSeconds,
            @Value("${app.verification-code.resend-cooldown-seconds:60}") int resendCooldownSeconds,
            @Value("${app.verification-code.max-verify-attempts:5}") int maxVerifyAttempts,
            @Value("${app.verification-code.email-hourly-limit:5}") int emailHourlyLimit,
            @Value("${app.verification-code.ip-hourly-limit:20}") int ipHourlyLimit
    ) {
        this.redisTemplate = redisTemplate;
        this.codeSecret = codeSecret.getBytes(StandardCharsets.UTF_8);
        this.codeTtlSeconds = codeTtlSeconds;
        this.resendCooldownSeconds = resendCooldownSeconds;
        this.maxVerifyAttempts = maxVerifyAttempts;
        this.emailHourlyLimit = emailHourlyLimit;
        this.ipHourlyLimit = ipHourlyLimit;
    }

    @Override
    public String issueRegistrationCode(String email, String clientIp) {
        return issueCode("register", email, clientIp);
    }

    @Override
    public String issuePasswordResetCode(String email, String clientIp) {
        return issueCode("password-reset", email, clientIp);
    }

    @Override
    public String issueResumeReviewContactCode(String email, String clientIp) {
        return issueCode("resume-review-contact", email, clientIp);
    }

    private String issueCode(String purpose, String email, String clientIp) {
        String emailFingerprint = fingerprint(email);
        String cooldownKey = cooldownKey(purpose, emailFingerprint);
        Boolean acquired = redisTemplate.opsForValue().setIfAbsent(
                cooldownKey,
                "1",
                Duration.ofSeconds(resendCooldownSeconds)
        );
        if (!Boolean.TRUE.equals(acquired)) {
            throw new BusinessException(ResultCode.SEND_CODE_TOO_FREQUENT);
        }

        try {
            enforceHourlyLimit("verify:quota:email:" + emailFingerprint, emailHourlyLimit);
            enforceHourlyLimit("verify:quota:ip:" + fingerprint(normalizeClientIp(clientIp)), ipHourlyLimit);

            String code = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
            redisTemplate.opsForValue().set(
                    codeKey(purpose, emailFingerprint),
                    hashCode(purpose, email, code),
                    Duration.ofSeconds(codeTtlSeconds)
            );
            redisTemplate.delete(attemptKey(purpose, emailFingerprint));
            return code;
        } catch (RuntimeException exception) {
            redisTemplate.delete(cooldownKey);
            throw exception;
        }
    }

    @Override
    public void rollbackRegistrationCode(String email) {
        rollbackCode("register", email);
    }

    @Override
    public void rollbackPasswordResetCode(String email) {
        rollbackCode("password-reset", email);
    }

    @Override
    public void rollbackResumeReviewContactCode(String email) {
        rollbackCode("resume-review-contact", email);
    }

    private void rollbackCode(String purpose, String email) {
        String emailFingerprint = fingerprint(email);
        redisTemplate.delete(List.of(
                codeKey(purpose, emailFingerprint),
                attemptKey(purpose, emailFingerprint),
                cooldownKey(purpose, emailFingerprint)
        ));
    }

    @Override
    public ConsumeResult consumeRegistrationCode(String email, String code) {
        return consumeCode("register", email, code);
    }

    @Override
    public ConsumeResult consumePasswordResetCode(String email, String code) {
        return consumeCode("password-reset", email, code);
    }

    @Override
    public ConsumeResult consumeResumeReviewContactCode(String email, String code) {
        return consumeCode("resume-review-contact", email, code);
    }

    private ConsumeResult consumeCode(String purpose, String email, String code) {
        String emailFingerprint = fingerprint(email);
        Long result = redisTemplate.execute(
                CONSUME_CODE_SCRIPT,
                List.of(codeKey(purpose, emailFingerprint), attemptKey(purpose, emailFingerprint)),
                hashCode(purpose, email, code),
                String.valueOf(maxVerifyAttempts),
                String.valueOf(codeTtlSeconds)
        );
        if (result == null || result == -1L) {
            return ConsumeResult.EXPIRED;
        }
        if (result == 1L) {
            return ConsumeResult.VERIFIED;
        }
        if (result == -2L) {
            return ConsumeResult.ATTEMPTS_EXCEEDED;
        }
        return ConsumeResult.INVALID;
    }

    private void enforceHourlyLimit(String baseKey, int limit) {
        long hourBucket = System.currentTimeMillis() / 3_600_000L;
        Long count = redisTemplate.execute(
                INCREMENT_WITH_TTL_SCRIPT,
                List.of(baseKey + ":" + hourBucket),
                "3700"
        );
        if (count == null || count > limit) {
            throw new BusinessException(ResultCode.SEND_CODE_LIMIT_EXCEEDED);
        }
    }

    private String hashCode(String purpose, String email, String code) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(codeSecret, HMAC_ALGORITHM));
            byte[] digest = mac.doFinal((purpose + ":" + email + ":" + code).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to hash verification code", exception);
        }
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

    private String normalizeClientIp(String clientIp) {
        return clientIp == null || clientIp.isBlank() ? "unknown" : clientIp.trim();
    }

    private String codeKey(String purpose, String emailFingerprint) {
        return "verify:" + purpose + ":code:" + emailFingerprint;
    }

    private String attemptKey(String purpose, String emailFingerprint) {
        return "verify:" + purpose + ":attempts:" + emailFingerprint;
    }

    private String cooldownKey(String purpose, String emailFingerprint) {
        return "verify:" + purpose + ":cooldown:" + emailFingerprint;
    }
}
