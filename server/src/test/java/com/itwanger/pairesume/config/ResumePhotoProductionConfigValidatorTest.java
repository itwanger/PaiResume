package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ResumePhotoProductionConfigValidatorTest {
    @Test
    void developmentStartupRejectsMissingMandatoryOssConfiguration() {
        ResumePhotoProductionConfigValidator validator = validator(new ResumePhotoOssProperties(), "development");
        assertThrows(IllegalStateException.class, validator::validate);
    }

    @Test
    void developmentStartupAcceptsValidOssWithoutProductionConfirmationFlags() {
        assertDoesNotThrow(() -> validator(validProperties(), "development").validate());
    }

    @Test
    void productionStartupRequiresAllOperationalConfirmationFlags() {
        ResumePhotoOssProperties properties = validProperties();
        assertThrows(IllegalStateException.class, () -> validator(properties, "production").validate());

        properties.setPrivateBucketConfirmed(true);
        properties.setCorsConfirmed(true);
        properties.setStagingLifecycleConfirmed(true);
        properties.setRamPolicyConfirmed(true);
        assertDoesNotThrow(() -> validator(properties, "production").validate());
    }

    private ResumePhotoProductionConfigValidator validator(ResumePhotoOssProperties properties,
                                                            String environment) {
        ResumePhotoProductionConfigValidator validator = new ResumePhotoProductionConfigValidator(properties);
        ReflectionTestUtils.setField(validator, "environment", environment);
        return validator;
    }

    private ResumePhotoOssProperties validProperties() {
        ResumePhotoOssProperties properties = new ResumePhotoOssProperties();
        properties.setEndpoint("https://oss-cn-hangzhou.aliyuncs.com");
        properties.setBucket("private-resume-bucket");
        properties.setAccessKeyId("test-access-key-id");
        properties.setAccessKeySecret("test-access-key-secret");
        return properties;
    }
}
