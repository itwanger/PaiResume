package com.itwanger.pairesume.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;

@Component
public class StartupConfigValidator {

    static final String DEFAULT_JWT_SECRET =
            "dGhpcyBpcyBhIHZlcnkgc2VjdXJlIGtleSBmb3IgcGFpIHJlc3VtZSBqd3QgdG9rZW4gZ2VuZXJhdGlvbiBhbmQgdmFsaWRhdGlvbiBwdXJwb3Nl";
    static final String DEFAULT_VERIFICATION_CODE_SECRET = "development-only-change-me-32-bytes";
    private static final Set<String> SUPPORTED_ENVIRONMENTS = Set.of("development", "test", "production");

    private final String appEnvironment;
    private final String publicUrl;
    private final String jwtSecret;
    private final String verificationCodeSecret;
    private final String mailUsername;
    private final String mailPassword;
    private final String mailFrom;
    private final String mailHost;
    private final boolean mailStartTlsEnabled;
    private final boolean mailStartTlsRequired;
    private final boolean mailSslEnabled;
    private final boolean mailTestConnection;
    private final String allowedOriginPatterns;
    private final String forwardHeadersStrategy;
    private final String datasourceUrl;
    private final String datasourceUsername;
    private final String datasourcePassword;
    private final boolean flywayEnabled;
    private final String flywayUsername;
    private final String flywayPassword;
    private final String redisPassword;
    private final String aiApiKey;
    private final boolean springdocEnabled;
    private final boolean refreshCookieSecure;
    private final long refreshCookieMaxAgeSeconds;
    private final long accessTokenExpirationMs;
    private final long refreshTokenExpirationMs;
    private final WechatQrAuthProperties wechatQrAuthProperties;

    public StartupConfigValidator(
            @Value("${app.environment:unset}") String appEnvironment,
            @Value("${app.public-url:https://resume.paicoding.com}") String publicUrl,
            @Value("${jwt.secret}") String jwtSecret,
            @Value("${app.verification-code.secret}") String verificationCodeSecret,
            @Value("${spring.mail.username:}") String mailUsername,
            @Value("${spring.mail.password:}") String mailPassword,
            @Value("${app.mail.from:}") String mailFrom,
            @Value("${spring.mail.host:}") String mailHost,
            @Value("${spring.mail.properties.mail.smtp.starttls.enable:false}") boolean mailStartTlsEnabled,
            @Value("${spring.mail.properties.mail.smtp.starttls.required:false}") boolean mailStartTlsRequired,
            @Value("${spring.mail.properties.mail.smtp.ssl.enable:false}") boolean mailSslEnabled,
            @Value("${spring.mail.test-connection:false}") boolean mailTestConnection,
            @Value("${app.cors.allowed-origin-patterns:}") String allowedOriginPatterns,
            @Value("${server.forward-headers-strategy:none}") String forwardHeadersStrategy,
            @Value("${spring.datasource.url:}") String datasourceUrl,
            @Value("${spring.datasource.username:}") String datasourceUsername,
            @Value("${spring.datasource.password:}") String datasourcePassword,
            @Value("${spring.flyway.enabled:true}") boolean flywayEnabled,
            @Value("${spring.flyway.user:}") String flywayUsername,
            @Value("${spring.flyway.password:}") String flywayPassword,
            @Value("${spring.data.redis.password:}") String redisPassword,
            @Value("${ai.api-key:}") String aiApiKey,
            @Value("${springdoc.api-docs.enabled:true}") boolean springdocEnabled,
            @Value("${app.auth.refresh-cookie-secure:false}") boolean refreshCookieSecure,
            @Value("${app.auth.refresh-cookie-max-age-seconds:604800}") long refreshCookieMaxAgeSeconds,
            @Value("${jwt.access-token-expiration}") long accessTokenExpirationMs,
            @Value("${jwt.refresh-token-expiration}") long refreshTokenExpirationMs,
            WechatQrAuthProperties wechatQrAuthProperties
    ) {
        this.appEnvironment = appEnvironment;
        this.publicUrl = publicUrl;
        this.jwtSecret = jwtSecret;
        this.verificationCodeSecret = verificationCodeSecret;
        this.mailUsername = mailUsername;
        this.mailPassword = mailPassword;
        this.mailFrom = mailFrom;
        this.mailHost = mailHost;
        this.mailStartTlsEnabled = mailStartTlsEnabled;
        this.mailStartTlsRequired = mailStartTlsRequired;
        this.mailSslEnabled = mailSslEnabled;
        this.mailTestConnection = mailTestConnection;
        this.allowedOriginPatterns = allowedOriginPatterns;
        this.forwardHeadersStrategy = forwardHeadersStrategy;
        this.datasourceUrl = datasourceUrl;
        this.datasourceUsername = datasourceUsername;
        this.datasourcePassword = datasourcePassword;
        this.flywayEnabled = flywayEnabled;
        this.flywayUsername = flywayUsername;
        this.flywayPassword = flywayPassword;
        this.redisPassword = redisPassword;
        this.aiApiKey = aiApiKey;
        this.springdocEnabled = springdocEnabled;
        this.refreshCookieSecure = refreshCookieSecure;
        this.refreshCookieMaxAgeSeconds = refreshCookieMaxAgeSeconds;
        this.accessTokenExpirationMs = accessTokenExpirationMs;
        this.refreshTokenExpirationMs = refreshTokenExpirationMs;
        this.wechatQrAuthProperties = wechatQrAuthProperties;
    }

    @PostConstruct
    public void validate() {
        String environment = appEnvironment == null ? "" : appEnvironment.trim().toLowerCase();
        if (!SUPPORTED_ENVIRONMENTS.contains(environment)) {
            throw new IllegalStateException(
                    "APP_ENV must be explicitly set to development, test, or production"
            );
        }
        if (!"production".equals(environment)) {
            return;
        }

        requireStrongSecret("JWT_SECRET", jwtSecret, DEFAULT_JWT_SECRET);
        requireStrongSecret(
                "VERIFICATION_CODE_SECRET",
                verificationCodeSecret,
                DEFAULT_VERIFICATION_CODE_SECRET
        );
        if (jwtSecret.equals(verificationCodeSecret)) {
            throw new IllegalStateException("JWT_SECRET and VERIFICATION_CODE_SECRET must be different");
        }
        rejectProductionPlaceholder("JWT_SECRET", jwtSecret, false);
        rejectProductionPlaceholder("VERIFICATION_CODE_SECRET", verificationCodeSecret, false);
        validateProductionPublicUrl();
        if (!StringUtils.hasText(mailHost)
                || !StringUtils.hasText(mailUsername)
                || !StringUtils.hasText(mailPassword)
                || !StringUtils.hasText(mailFrom)) {
            throw new IllegalStateException(
                    "MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD, and MAIL_FROM are required in production"
            );
        }
        rejectProductionPlaceholder("MAIL_USERNAME", mailUsername, true);
        rejectProductionPlaceholder("MAIL_PASSWORD", mailPassword, false);
        rejectProductionPlaceholder("MAIL_FROM", mailFrom, true);
        rejectProductionPlaceholder("MYSQL_PASSWORD", datasourcePassword, false);
        rejectProductionPlaceholder("FLYWAY_PASSWORD", flywayPassword, false);
        rejectProductionPlaceholder("REDIS_PASSWORD", redisPassword, false);
        rejectProductionPlaceholder("AI_API_KEY", aiApiKey, false);
        validateProductionWechatQrAuth();
        if (!mailSslEnabled && !(mailStartTlsEnabled && mailStartTlsRequired)) {
            throw new IllegalStateException(
                    "Production SMTP must use implicit TLS or required STARTTLS"
            );
        }
        if (!mailTestConnection) {
            throw new IllegalStateException("MAIL_TEST_CONNECTION must be true in production");
        }
        validateProductionOrigins();
        validateProductionInfrastructure();
    }

    private void requireStrongSecret(String name, String value, String forbiddenDefault) {
        if (!StringUtils.hasText(value) || value.length() < 32 || forbiddenDefault.equals(value)) {
            throw new IllegalStateException(name + " must be a non-default value of at least 32 characters");
        }
    }

    private void rejectProductionPlaceholder(String name, String value, boolean emailField) {
        if (!StringUtils.hasText(value)) {
            return;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        boolean yourPlaceholder = normalized.startsWith("your_")
                && (!emailField || !normalized.contains("@") || normalized.startsWith("your_email@"));
        boolean publishedPlaceholder = normalized.contains("replace-me")
                || normalized.startsWith("replace-with-")
                || yourPlaceholder;
        boolean exampleEmail = emailField && normalized.endsWith("@example.com");
        if (publishedPlaceholder || exampleEmail) {
            throw new IllegalStateException(name + " must not use a published placeholder value");
        }
    }

    private void validateProductionPublicUrl() {
        if (!StringUtils.hasText(publicUrl)) {
            throw new IllegalStateException("APP_PUBLIC_URL is required in production");
        }
        try {
            URI uri = new URI(publicUrl.trim());
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || !StringUtils.hasText(host)
                    || host.contains("*")
                    || "localhost".equalsIgnoreCase(host)
                    || "127.0.0.1".equals(host)
                    || "::1".equals(host)
                    || uri.getUserInfo() != null
                    || uri.getQuery() != null
                    || uri.getFragment() != null) {
                throw new IllegalStateException(
                        "APP_PUBLIC_URL must be an explicit public HTTPS URL in production"
                );
            }
        } catch (URISyntaxException exception) {
            throw new IllegalStateException("APP_PUBLIC_URL must be a valid URI", exception);
        }
    }

    private void validateProductionWechatQrAuth() {
        if (wechatQrAuthProperties == null || !wechatQrAuthProperties.isEnabled()) {
            return;
        }
        wechatQrAuthProperties.requireReady();
        URI gateway = URI.create(wechatQrAuthProperties.getGatewayBaseUrl().trim());
        String host = gateway.getHost();
        if (!"https".equalsIgnoreCase(gateway.getScheme())
                || !StringUtils.hasText(host)
                || host.contains("*")
                || "localhost".equalsIgnoreCase(host)
                || "127.0.0.1".equals(host)
                || "::1".equals(host)) {
            throw new IllegalStateException(
                    "PAICONGMING_WECHAT_GATEWAY_BASE_URL must be an explicit public HTTPS URL in production"
            );
        }
        rejectProductionPlaceholder(
                "PAICONGMING_WECHAT_BRIDGE_SECRET",
                wechatQrAuthProperties.getBridgeSecret(),
                false
        );
        rejectProductionPlaceholder(
                "PAICONGMING_WECHAT_APP_ID",
                wechatQrAuthProperties.getAccountAppId(),
                false
        );
        if (wechatQrAuthProperties.getBridgeSecret().equals(jwtSecret)
                || wechatQrAuthProperties.getBridgeSecret().equals(verificationCodeSecret)) {
            throw new IllegalStateException(
                    "PAICONGMING_WECHAT_BRIDGE_SECRET must be independent from other application secrets"
            );
        }
    }

    private void validateProductionOrigins() {
        var origins = Arrays.stream(allowedOriginPatterns.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .toList();
        if (origins.isEmpty()) {
            throw new IllegalStateException("APP_CORS_ALLOWED_ORIGIN_PATTERNS is required in production");
        }
        boolean unsafe = origins.stream().anyMatch(origin ->
                origin.contains("*")
                        || !origin.startsWith("https://")
                        || origin.contains("localhost")
                        || origin.contains("127.0.0.1")
                        || origin.contains("[::1]")
        );
        if (unsafe) {
            throw new IllegalStateException(
                    "Production CORS origins must be explicit HTTPS origins without wildcards or localhost"
            );
        }
    }

    private void validateProductionInfrastructure() {
        if (!"native".equalsIgnoreCase(forwardHeadersStrategy)) {
            throw new IllegalStateException(
                    "FORWARD_HEADERS_STRATEGY must be native in production behind a trusted reverse proxy"
            );
        }
        if (!StringUtils.hasText(datasourceUsername)
                || "root".equalsIgnoreCase(datasourceUsername)
                || !StringUtils.hasText(datasourcePassword)
                || "123456".equals(datasourcePassword)) {
            throw new IllegalStateException(
                    "Production MySQL must use a dedicated least-privilege account with a non-default password"
            );
        }
        if (!datasourceUrl.contains("useSSL=true")
                || !datasourceUrl.contains("requireSSL=true")
                || !datasourceUrl.contains("verifyServerCertificate=true")
                || !datasourceUrl.contains("allowPublicKeyRetrieval=false")) {
            throw new IllegalStateException(
                    "Production MySQL URL must require verified TLS and disable public key retrieval"
            );
        }
        if (!flywayEnabled
                || !StringUtils.hasText(flywayUsername)
                || !StringUtils.hasText(flywayPassword)) {
            throw new IllegalStateException(
                    "Production Flyway migrations require FLYWAY_USERNAME and FLYWAY_PASSWORD"
            );
        }
        if (datasourceUsername.equalsIgnoreCase(flywayUsername)) {
            throw new IllegalStateException(
                    "Production Flyway and application datasource must use separate database accounts"
            );
        }
        if (!StringUtils.hasText(redisPassword)) {
            throw new IllegalStateException("REDIS_PASSWORD is required in production");
        }
        if (springdocEnabled) {
            throw new IllegalStateException("SPRINGDOC_ENABLED must be false in production");
        }
        if (!refreshCookieSecure) {
            throw new IllegalStateException("REFRESH_COOKIE_SECURE must be true in production");
        }
        if (accessTokenExpirationMs < 300_000L || accessTokenExpirationMs > 900_000L) {
            throw new IllegalStateException("Access token lifetime must be between 5 and 15 minutes in production");
        }
        if (refreshTokenExpirationMs < 86_400_000L || refreshTokenExpirationMs > 2_592_000_000L) {
            throw new IllegalStateException("Refresh token lifetime must be between 1 and 30 days in production");
        }
        long refreshLifetimeSeconds = (refreshTokenExpirationMs + 999L) / 1000L;
        if (refreshCookieMaxAgeSeconds <= 0 || refreshCookieMaxAgeSeconds > refreshLifetimeSeconds) {
            throw new IllegalStateException("Refresh cookie lifetime must not exceed refresh token lifetime");
        }
    }
}
