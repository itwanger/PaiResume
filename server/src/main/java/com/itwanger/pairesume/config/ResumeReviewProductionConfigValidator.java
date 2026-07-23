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

    private final ResumeReviewProperties properties;

    @Value("${app.environment:unset}")
    private String environment;

    @PostConstruct
    public void validate() {
        if (!"production".equalsIgnoreCase(environment)) return;
        if (!validEmail(properties.getRecipientEmail())) {
            throw new IllegalStateException("RESUME_REVIEW_RECIPIENT_EMAIL must be a real fixed mailbox in production");
        }
        String domain = properties.getMessageIdDomain();
        if (!StringUtils.hasText(domain) || !MESSAGE_ID_DOMAIN.matcher(domain.trim()).matches()
                || domain.toLowerCase(Locale.ROOT).contains("localhost")
                || domain.toLowerCase(Locale.ROOT).endsWith(".invalid")) {
            throw new IllegalStateException("RESUME_REVIEW_MESSAGE_ID_DOMAIN must be a public mail domain");
        }
        if (!StringUtils.hasText(properties.getFollowOfficialAccountName())
                || !validPublicHttps(properties.getFollowQrCodeUrl())) {
            throw new IllegalStateException(
                    "RESUME_REVIEW_FOLLOW_OFFICIAL_ACCOUNT_NAME and a public HTTPS RESUME_REVIEW_FOLLOW_QR_CODE_URL are required");
        }
        if (properties.isFollowBridgeEnabled()
                && (!StringUtils.hasText(properties.getFollowBridgeHmacSecret())
                || properties.getFollowBridgeHmacSecret().length() < 32)) {
            throw new IllegalStateException("RESUME_REVIEW_FOLLOW_BRIDGE_HMAC_SECRET must contain at least 32 characters");
        }
    }

    private boolean validEmail(String value) {
        if (!StringUtils.hasText(value)) return false;
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return EMAIL.matcher(normalized).matches()
                && !normalized.endsWith("@example.com")
                && !normalized.contains("replace-me");
    }

    private boolean validPublicHttps(String value) {
        if (!StringUtils.hasText(value)) return false;
        try {
            URI uri = URI.create(value.trim());
            return "https".equalsIgnoreCase(uri.getScheme())
                    && StringUtils.hasText(uri.getHost())
                    && uri.getUserInfo() == null
                    && uri.getQuery() == null
                    && uri.getFragment() == null
                    && !uri.getHost().equalsIgnoreCase("localhost")
                    && !uri.getHost().endsWith(".invalid");
        } catch (RuntimeException exception) {
            return false;
        }
    }
}
