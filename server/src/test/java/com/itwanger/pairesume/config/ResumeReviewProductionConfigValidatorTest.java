package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ResumeReviewProductionConfigValidatorTest {

    @Test
    void productionDefaultSwitchIsFailClosedAndSkipsUnusedExternalIntegrations() {
        ResumeReviewProperties properties = new ResumeReviewProperties();

        assertDoesNotThrow(validator(
                properties, new ResumeReviewOssProperties(), "production")::validate);
        org.junit.jupiter.api.Assertions.assertFalse(properties.isEnabled());
    }

    @Test
    void productionRequiresRealMailboxAndPublicMessageIdDomain() {
        ResumeReviewProperties properties = validProperties();
        ResumeReviewProductionConfigValidator validator = validator(properties, validOssProperties(), "production");
        assertDoesNotThrow(validator::validate);

        properties.setRecipientEmail("review@");
        assertThrows(IllegalStateException.class, validator::validate);

        properties = validProperties();
        properties.setMessageIdDomain("localhost");
        assertThrows(IllegalStateException.class,
                validator(properties, validOssProperties(), "production")::validate);
    }

    @Test
    void productionRequiresPrivateOssDirectUploadConfiguration() {
        ResumeReviewOssProperties oss = validOssProperties();
        oss.setEnabled(false);
        assertThrows(IllegalStateException.class,
                validator(validProperties(), oss, "production")::validate);

        oss = validOssProperties();
        oss.setEndpoint("http://oss-cn-hangzhou.aliyuncs.com");
        assertThrows(IllegalStateException.class,
                validator(validProperties(), oss, "production")::validate);

        oss = validOssProperties();
        oss.setEndpoint("https://oss-cn-hangzhou.aliyuncs.com/upload?debug=true");
        assertThrows(IllegalStateException.class,
                validator(validProperties(), oss, "production")::validate);

        oss = validOssProperties();
        oss.setObjectPrefix("pairesume/resume-review/staging/objects/");
        assertThrows(IllegalStateException.class,
                validator(validProperties(), oss, "production")::validate);

        oss = validOssProperties();
        oss.setStagingPrefix("pairesume\\resume-review\\staging/");
        assertThrows(IllegalStateException.class,
                validator(validProperties(), oss, "production")::validate);

        oss = validOssProperties();
        oss.setMaxPdfBytes(10L * 1024L * 1024L + 1L);
        assertThrows(IllegalStateException.class,
                validator(validProperties(), oss, "production")::validate);

        oss = validOssProperties();
        oss.setMaxConcurrentFinalizations(17);
        assertThrows(IllegalStateException.class,
                validator(validProperties(), oss, "production")::validate);
    }

    @Test
    void enabledProductionRequiresAllFourExternalOssConfirmations() {
        ResumeReviewOssProperties oss = validOssProperties();
        oss.setPrivateBucketConfirmed(false);
        assertThrows(IllegalStateException.class,
                validator(validProperties(), oss, "production")::validate);

        oss = validOssProperties();
        oss.setCorsConfirmed(false);
        assertThrows(IllegalStateException.class,
                validator(validProperties(), oss, "production")::validate);

        oss = validOssProperties();
        oss.setLifecycleConfirmed(false);
        assertThrows(IllegalStateException.class,
                validator(validProperties(), oss, "production")::validate);

        oss = validOssProperties();
        oss.setRamPolicyConfirmed(false);
        assertThrows(IllegalStateException.class,
                validator(validProperties(), oss, "production")::validate);
    }

    @Test
    void productionBoundsAutomaticMailRetries() {
        ResumeReviewProperties properties = validProperties();
        properties.setMailOutboxMaxAttempts(0);

        assertThrows(IllegalStateException.class,
                validator(properties, validOssProperties(), "production")::validate);
    }

    @Test
    void productionRequiresBoundedUploadRateLimits() {
        ResumeReviewUploadRateLimitProperties limits = validRateLimits();
        limits.setIpAttemptLimit(10);
        limits.setAccountAttemptLimit(20);

        assertThrows(IllegalStateException.class,
                validator(validProperties(), validOssProperties(), limits,
                        "production")::validate);
    }

    @Test
    void developmentKeepsExternalIntegrationsOptional() {
        assertDoesNotThrow(validator(
                new ResumeReviewProperties(), new ResumeReviewOssProperties(), "development")::validate);
    }

    private ResumeReviewProperties validProperties() {
        ResumeReviewProperties properties = new ResumeReviewProperties();
        properties.setEnabled(true);
        properties.setRecipientEmail("review@paicoding.com");
        properties.setMessageIdDomain("resume.paicoding.com");
        return properties;
    }

    private ResumeReviewOssProperties validOssProperties() {
        ResumeReviewOssProperties properties = new ResumeReviewOssProperties();
        properties.setEnabled(true);
        properties.setEndpoint("https://oss-cn-hangzhou.aliyuncs.com");
        properties.setBucket("pairesume-private");
        properties.setAccessKeyId("valid-access-key-id");
        properties.setAccessKeySecret("valid-access-key-secret");
        properties.setPrivateBucketConfirmed(true);
        properties.setCorsConfirmed(true);
        properties.setLifecycleConfirmed(true);
        properties.setRamPolicyConfirmed(true);
        return properties;
    }

    private ResumeReviewProductionConfigValidator validator(
            ResumeReviewProperties properties,
            ResumeReviewOssProperties ossProperties,
            String environment
    ) {
        return validator(properties, ossProperties, validRateLimits(), environment);
    }

    private ResumeReviewProductionConfigValidator validator(
            ResumeReviewProperties properties,
            ResumeReviewOssProperties ossProperties,
            ResumeReviewUploadRateLimitProperties rateLimits,
            String environment
    ) {
        ResumeReviewProductionConfigValidator validator =
                new ResumeReviewProductionConfigValidator(
                        properties, ossProperties, rateLimits);
        ReflectionTestUtils.setField(validator, "environment", environment);
        return validator;
    }

    private ResumeReviewUploadRateLimitProperties validRateLimits() {
        return new ResumeReviewUploadRateLimitProperties();
    }
}
