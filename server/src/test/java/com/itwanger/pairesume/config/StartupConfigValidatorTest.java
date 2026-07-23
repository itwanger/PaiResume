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

    @Test
    void productionRejectsPublishedPlaceholderValues() {
        StartupConfigValidator jwtPlaceholder = validator(
                "production",
                "https://resume.paicoding.com",
                "replace-with-at-least-32-random-bytes",
                "verification-secret-longer-than-thirty-two-characters",
                "sender@paicoding.com",
                "strong-smtp-password",
                "sender@paicoding.com",
                "https://resume.paicoding.com",
                "native",
                TLS_URL,
                "pai_resume_app",
                "strong-database-password",
                "strong-redis-password",
                "valid-ai-api-key",
                false,
                true,
                604800L,
                900000L,
                604800000L
        );
        StartupConfigValidator aiPlaceholder = validator(
                "production",
                "https://resume.paicoding.com",
                "jwt-secret-that-is-longer-than-thirty-two-characters",
                "verification-secret-longer-than-thirty-two-characters",
                "sender@paicoding.com",
                "strong-smtp-password",
                "sender@paicoding.com",
                "https://resume.paicoding.com",
                "native",
                TLS_URL,
                "pai_resume_app",
                "strong-database-password",
                "strong-redis-password",
                "your_api_key",
                false,
                true,
                604800L,
                900000L,
                604800000L
        );

        assertThrows(IllegalStateException.class, jwtPlaceholder::validate);
        assertThrows(IllegalStateException.class, aiPlaceholder::validate);
    }

    @Test
    void productionRejectsExampleDotComMailWithoutRejectingRealMail() {
        StartupConfigValidator placeholderMail = validProductionValidator("https://resume.paicoding.com", "sender@example.com");
        StartupConfigValidator realMail = validProductionValidator("https://resume.paicoding.com", "sender@example.org");
        StartupConfigValidator realYourPrefixMail = validProductionValidator(
                "https://resume.paicoding.com", "your_team@paicoding.com");

        assertThrows(IllegalStateException.class, placeholderMail::validate);
        assertDoesNotThrow(realMail::validate);
        assertDoesNotThrow(realYourPrefixMail::validate);
    }

    @Test
    void enabledPaicongmingGatewayRequiresHttpsAndIndependentStrongBridgeSecret() {
        WechatQrAuthProperties properties = validWechatProperties();
        properties.setGatewayBaseUrl("http://localhost:8080");
        assertThrows(
                IllegalStateException.class,
                () -> validProductionValidator(properties).validate()
        );

        properties.setGatewayBaseUrl("https://paicoding.com");
        assertDoesNotThrow(() -> validProductionValidator(properties).validate());

        properties.setBridgeSecret("jwt-secret-that-is-longer-than-thirty-two-characters");
        assertThrows(
                IllegalStateException.class,
                () -> validProductionValidator(properties).validate()
        );
    }

    private StartupConfigValidator validProductionValidator() {
        return validProductionValidator("https://resume.paicoding.com");
    }

    private StartupConfigValidator validProductionValidator(String publicUrl) {
        return validProductionValidator(publicUrl, "sender@paicoding.com");
    }

    private StartupConfigValidator validProductionValidator(String publicUrl, String mailAddress) {
        return validator(
                "production",
                publicUrl,
                "jwt-secret-that-is-longer-than-thirty-two-characters",
                "verification-secret-longer-than-thirty-two-characters",
                mailAddress,
                "smtp-secret",
                mailAddress,
                "https://resume.example.com",
                "native",
                TLS_URL,
                "pai_resume_app",
                "strong-database-password",
                "strong-redis-password",
                "valid-ai-api-key",
                false,
                true,
                604800L,
                900000L,
                604800000L
        );
    }

    private StartupConfigValidator validProductionValidator(WechatQrAuthProperties properties) {
        return validator(
                "production",
                "https://resume.paicoding.com",
                "jwt-secret-that-is-longer-than-thirty-two-characters",
                "verification-secret-longer-than-thirty-two-characters",
                "sender@paicoding.com",
                "smtp-secret",
                "sender@paicoding.com",
                "https://resume.paicoding.com",
                "native",
                TLS_URL,
                "pai_resume_app",
                "strong-database-password",
                "strong-redis-password",
                "valid-ai-api-key",
                false,
                true,
                604800L,
                900000L,
                604800000L,
                properties
        );
    }

    private WechatQrAuthProperties validWechatProperties() {
        WechatQrAuthProperties properties = new WechatQrAuthProperties();
        properties.setEnabled(true);
        properties.setGatewayBaseUrl("https://paicoding.com");
        properties.setBridgeSecret("paicongming-bridge-secret-at-least-32-characters");
        properties.setAccountAppId("wx1234567890abcdef");
        properties.setScenePrefix("pr_");
        return properties;
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
            String aiApiKey,
            boolean springdocEnabled,
            boolean refreshCookieSecure,
            long refreshCookieMaxAgeSeconds,
            long accessTokenExpirationMs,
            long refreshTokenExpirationMs
    ) {
        return validator(
                environment, publicUrl, jwtSecret, verificationSecret, mailUsername,
                mailPassword, mailFrom, origins, forwardHeadersStrategy, datasourceUrl,
                datasourceUsername, datasourcePassword, redisPassword, aiApiKey,
                springdocEnabled, refreshCookieSecure, refreshCookieMaxAgeSeconds,
                accessTokenExpirationMs, refreshTokenExpirationMs,
                new WechatQrAuthProperties()
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
            String aiApiKey,
            boolean springdocEnabled,
            boolean refreshCookieSecure,
            long refreshCookieMaxAgeSeconds,
            long accessTokenExpirationMs,
            long refreshTokenExpirationMs,
            WechatQrAuthProperties wechatProperties
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
                aiApiKey,
                springdocEnabled,
                refreshCookieSecure,
                refreshCookieMaxAgeSeconds,
                accessTokenExpirationMs,
                refreshTokenExpirationMs,
                wechatProperties
        );
    }
}
