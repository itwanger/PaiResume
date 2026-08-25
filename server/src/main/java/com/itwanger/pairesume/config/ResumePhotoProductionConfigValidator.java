package com.itwanger.pairesume.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class ResumePhotoProductionConfigValidator {
    private static final Pattern PREFIX = Pattern.compile("^[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*/$");

    private final ResumePhotoOssProperties properties;

    @PostConstruct
    public void validate() {
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
    }

    private void prefix(String value, String name) {
        if (!StringUtils.hasText(value) || !PREFIX.matcher(value.strip()).matches()) {
            throw new IllegalStateException(name + " is invalid");
        }
    }

}
