package com.itwanger.pairesume.config;

import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Starts a brand-new database from the V5 baseline so V6 can create the current
 * complete schema. Legacy V1-V5 migrations are retained only for checksum and
 * upgrade compatibility with installations that already have Flyway history.
 */
@Configuration
public class FlywayMigrationConfig {

    private static final Logger log = LoggerFactory.getLogger(FlywayMigrationConfig.class);

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            if (isSchemaEmpty(flyway)) {
                log.info("Empty database detected; creating Flyway V5 baseline before current schema migrations");
                flyway.baseline();
            }
            flyway.migrate();
        };
    }

    private boolean isSchemaEmpty(Flyway flyway) {
        try (Connection connection = flyway.getConfiguration().getDataSource().getConnection();
             ResultSet tables = connection.getMetaData().getTables(
                     connection.getCatalog(),
                     null,
                     "%",
                     new String[]{"TABLE"}
             )) {
            return !tables.next();
        } catch (SQLException exception) {
            throw new IllegalStateException("Unable to inspect database before Flyway migration", exception);
        }
    }
}
