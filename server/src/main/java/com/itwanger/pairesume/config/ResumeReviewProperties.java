package com.itwanger.pairesume.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.resume-review")
public class ResumeReviewProperties {
    private int paymentOrderExpireMinutes = 30;
    private String recipientEmail;
    private String messageIdDomain = "resume.paicoding.com";
    private int mailOutboxMaxAttempts = 10;
}
