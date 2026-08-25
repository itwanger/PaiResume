package com.itwanger.pairesume.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.resume-review.oss")
public class ResumeReviewOssProperties {
    private boolean enabled = false;
    private String endpoint;
    private String bucket;
    private String accessKeyId;
    private String accessKeySecret;
    private String stagingPrefix = "pairesume/resume-review/staging/";
    private String objectPrefix = "pairesume/resume-review/objects/";
    private int uploadUrlTtlMinutes = 10;
    private int readyTtlMinutes = 30;
    private long maxPdfBytes = 5L * 1024L * 1024L;
    private int maxConcurrentFinalizations = 4;
    private int retentionDays = 30;
    private boolean privateBucketConfirmed = false;
    private boolean corsConfirmed = false;
    private boolean lifecycleConfirmed = false;
    private boolean ramPolicyConfirmed = false;
}
