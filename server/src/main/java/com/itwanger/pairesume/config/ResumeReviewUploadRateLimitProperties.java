package com.itwanger.pairesume.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.resume-review.upload-rate-limit")
public class ResumeReviewUploadRateLimitProperties {
    private int windowSeconds = 900;
    private int accountAttemptLimit = 20;
    private int ipAttemptLimit = 200;
}
