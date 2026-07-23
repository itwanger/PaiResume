package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ResumeReviewProductionConfigValidatorTest {

    @Test
    void productionRequiresRealMailboxDomainAndPublicFollowQr() {
        ResumeReviewProperties properties = validProperties();
        ResumeReviewProductionConfigValidator validator = validator(properties, "production");
        assertDoesNotThrow(validator::validate);

        properties.setRecipientEmail("review@");
        assertThrows(IllegalStateException.class, validator::validate);

        properties = validProperties();
        properties.setMessageIdDomain("localhost");
        assertThrows(IllegalStateException.class, validator(properties, "production")::validate);

        properties = validProperties();
        properties.setFollowQrCodeUrl("https://user@example.org/follow.png");
        assertThrows(IllegalStateException.class, validator(properties, "production")::validate);
    }

    @Test
    void enabledFollowBridgeRequiresIndependentStrongSecretShape() {
        ResumeReviewProperties properties = validProperties();
        properties.setFollowBridgeEnabled(true);
        properties.setFollowBridgeHmacSecret("short");

        assertThrows(IllegalStateException.class, validator(properties, "production")::validate);

        properties.setFollowBridgeHmacSecret("follow-bridge-secret-at-least-32-characters");
        assertDoesNotThrow(validator(properties, "production")::validate);
    }

    @Test
    void developmentKeepsExternalIntegrationsOptional() {
        assertDoesNotThrow(validator(new ResumeReviewProperties(), "development")::validate);
    }

    private ResumeReviewProperties validProperties() {
        ResumeReviewProperties properties = new ResumeReviewProperties();
        properties.setRecipientEmail("review@paicoding.com");
        properties.setMessageIdDomain("resume.paicoding.com");
        properties.setFollowOfficialAccountName("沉默王二");
        properties.setFollowQrCodeUrl("https://cdn.paicoding.com/follow.png");
        return properties;
    }

    private ResumeReviewProductionConfigValidator validator(
            ResumeReviewProperties properties,
            String environment
    ) {
        ResumeReviewProductionConfigValidator validator =
                new ResumeReviewProductionConfigValidator(properties);
        ReflectionTestUtils.setField(validator, "environment", environment);
        return validator;
    }
}
