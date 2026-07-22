package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ProductionFlywayGuardTest {

    @Test
    void environmentMustBeExplicitBeforeMigration() {
        var guard = new ProductionFlywayGuard("unset", "root", "root", "password");

        assertThrows(IllegalStateException.class, guard::validateBeforeMigration);
    }

    @Test
    void productionRejectsTheRuntimeDatabaseAccount() {
        var guard = new ProductionFlywayGuard(
                "production",
                "pai_resume_app",
                "pai_resume_app",
                "strong-password"
        );

        assertThrows(IllegalStateException.class, guard::validateBeforeMigration);
    }

    @Test
    void productionAllowsASeparateMigrationAccount() {
        var guard = new ProductionFlywayGuard(
                "production",
                "pai_resume_app",
                "pai_resume_migrator",
                "strong-password"
        );

        assertDoesNotThrow(guard::validateBeforeMigration);
    }
}
