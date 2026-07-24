package com.itwanger.pairesume.config;

import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.flyway.FlywayConfigurationCustomizer;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Set;

/**
 * Runs while Flyway is being configured, before any migration can change the database.
 */
@Component
public class ProductionFlywayGuard implements FlywayConfigurationCustomizer {

    private static final Set<String> SUPPORTED_ENVIRONMENTS =
            Set.of("development", "test", "production");

    private final String appEnvironment;
    private final String datasourceUsername;
    private final String flywayUsername;
    private final String flywayPassword;
    private final boolean sharedDatabaseAccountConfirmed;

    public ProductionFlywayGuard(
            @Value("${app.environment:unset}") String appEnvironment,
            @Value("${spring.datasource.username:}") String datasourceUsername,
            @Value("${spring.flyway.user:}") String flywayUsername,
            @Value("${spring.flyway.password:}") String flywayPassword,
            @Value("${app.database.shared-account-confirmed:false}") boolean sharedDatabaseAccountConfirmed
    ) {
        this.appEnvironment = appEnvironment;
        this.datasourceUsername = datasourceUsername;
        this.flywayUsername = flywayUsername;
        this.flywayPassword = flywayPassword;
        this.sharedDatabaseAccountConfirmed = sharedDatabaseAccountConfirmed;
    }

    @Override
    public void customize(FluentConfiguration configuration) {
        validateBeforeMigration();
    }

    void validateBeforeMigration() {
        String environment = appEnvironment == null ? "" : appEnvironment.trim().toLowerCase();
        if (!SUPPORTED_ENVIRONMENTS.contains(environment)) {
            throw new IllegalStateException(
                    "APP_ENV must be explicitly set before database migrations can run"
            );
        }
        if (!"production".equals(environment)) {
            return;
        }
        if (!StringUtils.hasText(flywayUsername) || !StringUtils.hasText(flywayPassword)) {
            throw new IllegalStateException(
                    "Production Flyway migrations require FLYWAY_USERNAME and FLYWAY_PASSWORD"
            );
        }
        if (flywayUsername.equalsIgnoreCase(datasourceUsername)
                && !sharedDatabaseAccountConfirmed) {
            throw new IllegalStateException(
                    "MYSQL_SHARED_ACCOUNT_CONFIRMED=true is required before Flyway reuses the application account"
            );
        }
    }
}
