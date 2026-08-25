package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ResumePhotoProductionConfigValidatorTest {
    @Test
    void startupAllowsAdminManagedOssToBeUnconfigured() {
        assertDoesNotThrow(() -> validator(new ResumePhotoOssProperties()).validate());
    }

    @Test
    void startupStillRejectsInvalidStaticPrefixes() {
        ResumePhotoOssProperties properties = new ResumePhotoOssProperties();
        properties.setStagingPrefix("../unsafe");
        assertThrows(IllegalStateException.class, () -> validator(properties).validate());
    }

    @Test
    void startupStillRejectsInvalidStaticLimits() {
        ResumePhotoOssProperties properties = new ResumePhotoOssProperties();
        properties.setMaxPhotoBytes(4L * 1024L * 1024L);
        assertThrows(IllegalStateException.class, () -> validator(properties).validate());
    }

    private ResumePhotoProductionConfigValidator validator(ResumePhotoOssProperties properties) {
        return new ResumePhotoProductionConfigValidator(properties);
    }
}
