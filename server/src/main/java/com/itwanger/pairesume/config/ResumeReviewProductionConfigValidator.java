package com.itwanger.pairesume.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.util.Locale;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class ResumeReviewProductionConfigValidator {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern MESSAGE_ID_DOMAIN = Pattern.compile("^[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final Pattern BUCKET = Pattern.compile("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$");
    private static final Pattern OBJECT_PREFIX =
            Pattern.compile("^[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*/$");

    private final ResumeReviewProperties properties;
    private final ResumeReviewOssProperties ossProperties;
    private final ResumeReviewUploadRateLimitProperties uploadRateLimitProperties;

    @Value("${app.environment:unset}")
    private String environment;

    @PostConstruct
    public void validate() {
        if (!"production".equalsIgnoreCase(environment)) return;
        if (!properties.isEnabled()) return;
        if (!validEmail(properties.getRecipientEmail())) {
            throw new IllegalStateException("RESUME_REVIEW_RECIPIENT_EMAIL must be a real fixed mailbox in production");
        }
        if (properties.getMailOutboxMaxAttempts() < 1
                || properties.getMailOutboxMaxAttempts() > 50) {
            throw new IllegalStateException(
                    "RESUME_REVIEW_MAIL_OUTBOX_MAX_ATTEMPTS must be between 1 and 50");
        }
        validateUploadRateLimit();
        validateOss();
        String domain = properties.getMessageIdDomain();
        if (!StringUtils.hasText(domain) || !MESSAGE_ID_DOMAIN.matcher(domain.trim()).matches()
                || domain.toLowerCase(Locale.ROOT).contains("localhost")
                || domain.toLowerCase(Locale.ROOT).endsWith(".invalid")) {
            throw new IllegalStateException("RESUME_REVIEW_MESSAGE_ID_DOMAIN must be a public mail domain");
        }
    }

    private void validateUploadRateLimit() {
        if (uploadRateLimitProperties.getWindowSeconds() < 60
                || uploadRateLimitProperties.getWindowSeconds() > 3600
                || uploadRateLimitProperties.getAccountAttemptLimit() < 1
                || uploadRateLimitProperties.getAccountAttemptLimit() > 100
                || uploadRateLimitProperties.getIpAttemptLimit() < 1
                || uploadRateLimitProperties.getIpAttemptLimit() > 2000
                || uploadRateLimitProperties.getIpAttemptLimit()
                < uploadRateLimitProperties.getAccountAttemptLimit()) {
            throw new IllegalStateException(
                    "Resume review upload rate limit configuration is invalid");
        }
    }

    private boolean validEmail(String value) {
        if (!StringUtils.hasText(value)) return false;
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return EMAIL.matcher(normalized).matches()
                && !normalized.endsWith("@example.com")
                && !normalized.contains("replace-me");
    }

    private void validateOss() {
        if (!ossProperties.isEnabled()) {
            throw new IllegalStateException("RESUME_REVIEW_OSS_ENABLED must be true in production");
        }
        requireConfirmed(ossProperties.isPrivateBucketConfirmed(),
                "RESUME_REVIEW_OSS_PRIVATE_BUCKET_CONFIRMED");
        requireConfirmed(ossProperties.isCorsConfirmed(),
                "RESUME_REVIEW_OSS_CORS_CONFIRMED");
        requireConfirmed(ossProperties.isLifecycleConfirmed(),
                "RESUME_REVIEW_OSS_LIFECYCLE_CONFIRMED");
        requireConfirmed(ossProperties.isRamPolicyConfirmed(),
                "RESUME_REVIEW_OSS_RAM_POLICY_CONFIRMED");
        try {
            URI endpoint = URI.create(ossProperties.getEndpoint());
            if (!"https".equalsIgnoreCase(endpoint.getScheme())
                    || !StringUtils.hasText(endpoint.getHost())
                    || endpoint.getUserInfo() != null
                    || (StringUtils.hasText(endpoint.getPath())
                    && !"/".equals(endpoint.getPath()))
                    || endpoint.getQuery() != null
                    || endpoint.getFragment() != null) {
                throw new IllegalArgumentException("HTTPS endpoint required");
            }
        } catch (RuntimeException exception) {
            throw new IllegalStateException("RESUME_REVIEW_OSS_ENDPOINT must be a valid HTTPS endpoint");
        }
        if (!StringUtils.hasText(ossProperties.getBucket())
                || !BUCKET.matcher(ossProperties.getBucket().trim()).matches()) {
            throw new IllegalStateException("RESUME_REVIEW_OSS_BUCKET is invalid");
        }
        requireSecret(ossProperties.getAccessKeyId(), "RESUME_REVIEW_OSS_ACCESS_KEY_ID");
        requireSecret(ossProperties.getAccessKeySecret(), "RESUME_REVIEW_OSS_ACCESS_KEY_SECRET");
        validatePrefix(ossProperties.getStagingPrefix(), "RESUME_REVIEW_OSS_STAGING_PREFIX");
        validatePrefix(ossProperties.getObjectPrefix(), "RESUME_REVIEW_OSS_OBJECT_PREFIX");
        String stagingPrefix = ossProperties.getStagingPrefix().trim();
        String objectPrefix = ossProperties.getObjectPrefix().trim();
        if (stagingPrefix.startsWith(objectPrefix) || objectPrefix.startsWith(stagingPrefix)) {
            throw new IllegalStateException(
                    "OSS staging and immutable object prefixes must differ and not overlap");
        }
        if (ossProperties.getUploadUrlTtlMinutes() < 1
                || ossProperties.getUploadUrlTtlMinutes() > 30
                || ossProperties.getReadyTtlMinutes() < 5
                || ossProperties.getReadyTtlMinutes() > 120) {
            throw new IllegalStateException("Resume review OSS upload TTL is outside the allowed range");
        }
        if (ossProperties.getMaxPdfBytes() < 1024
                || ossProperties.getMaxPdfBytes() > 10L * 1024L * 1024L) {
            throw new IllegalStateException(
                    "RESUME_REVIEW_OSS_MAX_PDF_BYTES must be between 1KB and 10MB");
        }
        if (ossProperties.getMaxConcurrentFinalizations() < 1
                || ossProperties.getMaxConcurrentFinalizations() > 16) {
            throw new IllegalStateException(
                    "RESUME_REVIEW_OSS_MAX_CONCURRENT_FINALIZATIONS must be between 1 and 16");
        }
        if (ossProperties.getRetentionDays() < 1 || ossProperties.getRetentionDays() > 90) {
            throw new IllegalStateException("RESUME_REVIEW_OSS_RETENTION_DAYS must be between 1 and 90");
        }
    }

    private void requireSecret(String value, String name) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (normalized.length() < 8 || normalized.contains("replace-me")
                || normalized.contains("example") || normalized.contains("待填写")) {
            throw new IllegalStateException(name + " must be configured with a non-placeholder value");
        }
    }

    private void requireConfirmed(boolean confirmed, String name) {
        if (!confirmed) {
            throw new IllegalStateException(name + " must be true when RESUME_REVIEW_ENABLED=true");
        }
    }

    private void validatePrefix(String value, String name) {
        if (!StringUtils.hasText(value)
                || !OBJECT_PREFIX.matcher(value.trim()).matches()) {
            throw new IllegalStateException(
                    name + " must contain only safe non-empty path segments and end with /");
        }
    }
}
