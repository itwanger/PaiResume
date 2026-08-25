package com.itwanger.pairesume.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class ResumeReviewProductionConfigValidator {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern MESSAGE_ID_DOMAIN = Pattern.compile("^[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private final ResumeReviewProperties properties;
    private final ResumeReviewUploadRateLimitProperties uploadRateLimitProperties;

    @Value("${app.environment:unset}")
    private String environment;

    @PostConstruct
    public void validate() {
        if (!"production".equalsIgnoreCase(environment)) return;
        if (!validEmail(properties.getRecipientEmail())) {
            throw new IllegalStateException("RESUME_REVIEW_RECIPIENT_EMAIL must be a real fixed mailbox in production");
        }
        if (properties.getMailOutboxMaxAttempts() < 1
                || properties.getMailOutboxMaxAttempts() > 50) {
            throw new IllegalStateException(
                    "RESUME_REVIEW_MAIL_OUTBOX_MAX_ATTEMPTS must be between 1 and 50");
        }
        validateUploadRateLimit();
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

}
