package com.itwanger.pairesume.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.resume-photo.oss")
public class ResumePhotoOssProperties {
    private String endpoint;
    private String bucket;
    private String accessKeyId;
    private String accessKeySecret;
    private String stagingPrefix = "pairesume/resume-photo/staging/";
    private String objectPrefix = "pairesume/resume-photo/objects/";
    private int uploadUrlTtlMinutes = 10;
    private int accessUrlTtlMinutes = 60;
    private long maxPhotoBytes = 3L * 1024L * 1024L;
    private int maxImageDimension = 4096;
    private long maxImagePixels = 16_000_000L;
    private int rateLimitWindowSeconds = 900;
    private int accountAttemptLimit = 20;
    private int ipAttemptLimit = 200;
    private boolean privateBucketConfirmed = false;
    private boolean corsConfirmed = false;
    private boolean stagingLifecycleConfirmed = false;
    private boolean ramPolicyConfirmed = false;
}
