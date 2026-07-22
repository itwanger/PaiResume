package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class StartupConfigValidatorTest {

    private static final String TLS_URL = "jdbc:mysql://db/pai_resume?allowPublicKeyRetrieval=false&useSSL=true&requireSSL=true&verifyServerCertificate=true";

    @Test
    void validProductionConfigurationPasses() {
        assertDoesNotThrow(() -> validProductionValidator().validate());
    }

    @Test
    void environmentMustBeExplicit() {
        StartupConfigValidator validator = validator(
                "unset",
                "https://resume.paicoding.com",
                "jwt-secret-that-is-longer-than-thirty-two-characters",
                "verification-secret-longer-than-thirty-two-characters",
                "",
                "",
                "",
                "",
                "none",
                "",
                "",
                "",
                "",
                true,
                false,
                604800L,
                900000L,
                604800000L
        );

        assertThrows(IllegalStateException.class, validator::validate);
    }

    @Test
    void productionRejectsDefaultSecretsAndInsecureInfrastructure() {
        StartupConfigValidator validator = validator(
                "production",
                "http://localhost:5173",
                StartupConfigValidator.DEFAULT_JWT_SECRET,
                StartupConfigValidator.DEFAULT_VERIFICATION_CODE_SECRET,
                "sender@example.com",
                "smtp-secret",
                "sender@example.com",
                "http://localhost:5173",
                "none",
                "jdbc:mysql://localhost/pai_resume?useSSL=false&allowPublicKeyRetrieval=true",
                "root",
                "123456",
                "",
                true,
                false,
                604800L,
                7_200_000L,
                604800000L
        );

        assertThrows(IllegalStateException.class, validator::validate);
    }

    @Test
    void developmentDoesNotRequireProductionInfrastructure() {
        StartupConfigValidator validator = validator(
                "development",
                "http://localhost:5173",
                StartupConfigValidator.DEFAULT_JWT_SECRET,
                StartupConfigValidator.DEFAULT_VERIFICATION_CODE_SECRET,
                "",
                "",
                "",
                "http://localhost:5173",
                "none",
                "jdbc:mysql://localhost/pai_resume?useSSL=false",
                "root",
                "123456",
                "",
                true,
                false,
                604800L,
                900000L,
                604800000L
        );

        assertDoesNotThrow(validator::validate);
    }

    @Test
    void productionRejectsUnsafePublicUrl() {
        assertThrows(
                IllegalStateException.class,
                () -> validProductionValidator("http://localhost:5173").validate()
        );
    }

    private StartupConfigValidator validProductionValidator() {
        return validProductionValidator("https://resume.paicoding.com");
    }

    private StartupConfigValidator validProductionValidator(String publicUrl) {
        return validator(
                "production",
                publicUrl,
                "jwt-secret-that-is-longer-than-thirty-two-characters",
                "verification-secret-longer-than-thirty-two-characters",
                "sender@example.com",
                "smtp-secret",
                "sender@example.com",
                "https://resume.example.com",
                "native",
                TLS_URL,
                "pai_resume_app",
                "strong-database-password",
                "strong-redis-password",
                false,
                true,
                604800L,
                900000L,
                604800000L
        );
    }

    private StartupConfigValidator validator(
            String environment,
            String publicUrl,
            String jwtSecret,
            String verificationSecret,
            String mailUsername,
            String mailPassword,
            String mailFrom,
            String origins,
            String forwardHeadersStrategy,
            String datasourceUrl,
            String datasourceUsername,
            String datasourcePassword,
            String redisPassword,
            boolean springdocEnabled,
            boolean refreshCookieSecure,
            long refreshCookieMaxAgeSeconds,
            long accessTokenExpirationMs,
            long refreshTokenExpirationMs
    ) {
        return new StartupConfigValidator(
                environment,
                publicUrl,
                jwtSecret,
                verificationSecret,
                mailUsername,
                mailPassword,
                mailFrom,
                "smtp.example.com",
                true,
                true,
                false,
                true,
                origins,
                forwardHeadersStrategy,
                datasourceUrl,
                datasourceUsername,
                datasourcePassword,
                true,
                "pai_resume_migrator",
                "strong-migration-password",
                redisPassword,
                springdocEnabled,
                refreshCookieSecure,
                refreshCookieMaxAgeSeconds,
                accessTokenExpirationMs,
                refreshTokenExpirationMs
        );
    }
}
