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
public class ResumePhotoProductionConfigValidator {
    private static final Pattern BUCKET = Pattern.compile("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$");
    private static final Pattern PREFIX = Pattern.compile("^[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*/$");

    private final ResumePhotoOssProperties properties;
    @Value("${app.environment:unset}")
    private String environment;

    @PostConstruct
    public void validate() {
        try {
            URI uri = URI.create(properties.getEndpoint());
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !StringUtils.hasText(uri.getHost())
                    || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                    || (StringUtils.hasText(uri.getPath()) && !"/".equals(uri.getPath()))) {
                throw new IllegalArgumentException();
            }
        } catch (RuntimeException exception) {
            throw new IllegalStateException("RESUME_PHOTO_OSS_ENDPOINT must be a valid HTTPS endpoint");
        }
        if (!StringUtils.hasText(properties.getBucket())
                || !BUCKET.matcher(properties.getBucket().strip()).matches()) {
            throw new IllegalStateException("RESUME_PHOTO_OSS_BUCKET is invalid");
        }
        secret(properties.getAccessKeyId(), "RESUME_PHOTO_OSS_ACCESS_KEY_ID");
        secret(properties.getAccessKeySecret(), "RESUME_PHOTO_OSS_ACCESS_KEY_SECRET");
        prefix(properties.getStagingPrefix(), "RESUME_PHOTO_OSS_STAGING_PREFIX");
        prefix(properties.getObjectPrefix(), "RESUME_PHOTO_OSS_OBJECT_PREFIX");
        String staging = properties.getStagingPrefix().strip();
        String objects = properties.getObjectPrefix().strip();
        if (staging.startsWith(objects) || objects.startsWith(staging)) {
            throw new IllegalStateException("Resume photo staging and object prefixes must not overlap");
        }
        if (properties.getUploadUrlTtlMinutes() < 1 || properties.getUploadUrlTtlMinutes() > 30
                || properties.getAccessUrlTtlMinutes() < 5 || properties.getAccessUrlTtlMinutes() > 360
                || properties.getMaxPhotoBytes() < 1024 || properties.getMaxPhotoBytes() > 3L * 1024L * 1024L
                || properties.getMaxImageDimension() < 256 || properties.getMaxImageDimension() > 4096
                || properties.getMaxImagePixels() < 65_536 || properties.getMaxImagePixels() > 16_000_000L
                || properties.getRateLimitWindowSeconds() < 60 || properties.getRateLimitWindowSeconds() > 3600
                || properties.getAccountAttemptLimit() < 1 || properties.getAccountAttemptLimit() > 100
                || properties.getIpAttemptLimit() < properties.getAccountAttemptLimit()
                || properties.getIpAttemptLimit() > 2000) {
            throw new IllegalStateException("Resume photo OSS limits are invalid");
        }
        if ("production".equalsIgnoreCase(environment)) {
            require(properties.isPrivateBucketConfirmed(), "RESUME_PHOTO_OSS_PRIVATE_BUCKET_CONFIRMED");
            require(properties.isCorsConfirmed(), "RESUME_PHOTO_OSS_CORS_CONFIRMED");
            require(properties.isStagingLifecycleConfirmed(), "RESUME_PHOTO_OSS_STAGING_LIFECYCLE_CONFIRMED");
            require(properties.isRamPolicyConfirmed(), "RESUME_PHOTO_OSS_RAM_POLICY_CONFIRMED");
        }
    }

    private void require(boolean value, String name) {
        if (!value) throw new IllegalStateException(name + " must be true in production");
    }

    private void prefix(String value, String name) {
        if (!StringUtils.hasText(value) || !PREFIX.matcher(value.strip()).matches()) {
            throw new IllegalStateException(name + " is invalid");
        }
    }

    private void secret(String value, String name) {
        String normalized = value == null ? "" : value.strip().toLowerCase(Locale.ROOT);
        if (normalized.length() < 8 || normalized.contains("replace-me") || normalized.contains("example")) {
            throw new IllegalStateException(name + " must be configured");
        }
    }
}
