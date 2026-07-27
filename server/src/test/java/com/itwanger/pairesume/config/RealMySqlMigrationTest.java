package com.itwanger.pairesume.config;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class RealMySqlMigrationTest {

    @Test
    void emptyDatabaseMigratesThroughShowcaseAccessSchema() throws Exception {
        String url = testSetting(
                "pairesume.test.mysql.url", "PAIRESUME_TEST_MYSQL_URL");
        String username = testSetting(
                "pairesume.test.mysql.username", "PAIRESUME_TEST_MYSQL_USERNAME");
        String password = testSetting(
                "pairesume.test.mysql.password", "PAIRESUME_TEST_MYSQL_PASSWORD");
        assumeTrue(!url.isBlank() && !username.isBlank(),
                "real MySQL migration test is opt-in");

        Flyway throughV23 = Flyway.configure()
                .dataSource(url, username, password)
                .locations("classpath:db/migration")
                .baselineVersion("5")
                .baselineOnMigrate(true)
                .target("23")
                .load();
        throughV23.baseline();
        throughV23.migrate();

        assertEquals("23",
                throughV23.info().current().getVersion().getVersion());
        try (var connection = DriverManager.getConnection(url, username, password)) {
            assertTrue(tableExists(connection, "resume_review_upload"));
            assertTrue(columnExists(connection, "resume_review_request",
                    "pdf_object_key"));
            assertTrue(columnExists(connection, "resume_review_upload",
                    "final_object_key"));
            assertFalse(columnExists(connection, "resume_showcase",
                    "access_type"));
        }

        Flyway throughV24 = Flyway.configure()
                .dataSource(url, username, password)
                .locations("classpath:db/migration")
                .baselineVersion("5")
                .baselineOnMigrate(true)
                .load();
        throughV24.migrate();

        assertEquals("24",
                throughV24.info().current().getVersion().getVersion());
        try (var connection = DriverManager.getConnection(url, username, password)) {
            assertTrue(columnExists(connection, "resume_showcase",
                    "access_type"));
        }
    }

    private boolean tableExists(java.sql.Connection connection, String table)
            throws Exception {
        try (var result = connection.getMetaData().getTables(
                connection.getCatalog(), null, table, new String[]{"TABLE"})) {
            return result.next();
        }
    }

    private boolean columnExists(java.sql.Connection connection, String table,
                                 String column) throws Exception {
        try (var result = connection.getMetaData().getColumns(
                connection.getCatalog(), null, table, column)) {
            return result.next();
        }
    }

    private String testSetting(String propertyName, String environmentName) {
        String propertyValue = System.getProperty(propertyName, "");
        return propertyValue.isBlank()
                ? System.getenv().getOrDefault(environmentName, "")
                : propertyValue;
    }
}
