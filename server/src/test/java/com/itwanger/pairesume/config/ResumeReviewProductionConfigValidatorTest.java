package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ResumeReviewProductionConfigValidatorTest {

    @Test
    void productionAlwaysRequiresExternalIntegrations() {
        ResumeReviewProperties properties = new ResumeReviewProperties();

        assertThrows(IllegalStateException.class, validator(properties, "production")::validate);
    }

    @Test
    void productionRequiresRealMailboxAndPublicMessageIdDomain() {
        ResumeReviewProperties properties = validProperties();
        ResumeReviewProductionConfigValidator validator = validator(properties, "production");
        assertDoesNotThrow(validator::validate);

        properties.setRecipientEmail("review@");
        assertThrows(IllegalStateException.class, validator::validate);

        properties = validProperties();
        properties.setMessageIdDomain("localhost");
        assertThrows(IllegalStateException.class,
                validator(properties, "production")::validate);
    }

    @Test
    void productionBoundsAutomaticMailRetries() {
        ResumeReviewProperties properties = validProperties();
        properties.setMailOutboxMaxAttempts(0);

        assertThrows(IllegalStateException.class,
                validator(properties, "production")::validate);
    }

    @Test
    void productionRequiresBoundedUploadRateLimits() {
        ResumeReviewUploadRateLimitProperties limits = validRateLimits();
        limits.setIpAttemptLimit(10);
        limits.setAccountAttemptLimit(20);

        assertThrows(IllegalStateException.class,
                validator(validProperties(), limits,
                        "production")::validate);
    }

    @Test
    void developmentKeepsExternalIntegrationsOptional() {
        assertDoesNotThrow(validator(new ResumeReviewProperties(), "development")::validate);
    }

    private ResumeReviewProperties validProperties() {
        ResumeReviewProperties properties = new ResumeReviewProperties();
        properties.setRecipientEmail("review@paicoding.com");
        properties.setMessageIdDomain("resume.paicoding.com");
        return properties;
    }

    private ResumeReviewProductionConfigValidator validator(
            ResumeReviewProperties properties,
            String environment
    ) {
        return validator(properties, validRateLimits(), environment);
    }

    private ResumeReviewProductionConfigValidator validator(
            ResumeReviewProperties properties,
            ResumeReviewUploadRateLimitProperties rateLimits,
            String environment
    ) {
        ResumeReviewProductionConfigValidator validator =
                new ResumeReviewProductionConfigValidator(
                        properties, rateLimits);
        ReflectionTestUtils.setField(validator, "environment", environment);
        return validator;
    }

    private ResumeReviewUploadRateLimitProperties validRateLimits() {
        return new ResumeReviewUploadRateLimitProperties();
    }
}
