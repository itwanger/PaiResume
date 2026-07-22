package com.itwanger.pairesume.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.ZoneId;
import java.util.TimeZone;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ApplicationTimeZoneValidatorTest {

    @AfterEach
    void restoreRequiredApplicationZone() {
        ApplicationTimeZone.enforce();
    }

    @Test
    void enforcementSetsShanghaiBeforeFrameworkInitialization() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));

        ApplicationTimeZone.enforce();

        assertEquals(ApplicationTimeZone.ZONE_ID, ZoneId.systemDefault());
        assertDoesNotThrow(() -> validator("Asia/Shanghai").validate());
    }

    @Test
    void validatorRejectsUnsupportedConfiguredZone() {
        ApplicationTimeZone.enforce();

        assertThrows(IllegalStateException.class,
                () -> validator("UTC").validate());
    }

    @Test
    void validatorRejectsJvmThatWasChangedAfterBoot() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));

        assertThrows(IllegalStateException.class,
                () -> validator("Asia/Shanghai").validate());
    }

    @Test
    void validatorRejectsDatabaseSessionsWithAnotherWallClock() {
        ApplicationTimeZone.enforce();

        assertThrows(IllegalStateException.class,
                () -> new ApplicationTimeZoneValidator("Asia/Shanghai", "SET time_zone = '+00:00'")
                        .validate());
    }

    private ApplicationTimeZoneValidator validator(String configuredZone) {
        return new ApplicationTimeZoneValidator(configuredZone, "SET time_zone = '+08:00'");
    }
}
