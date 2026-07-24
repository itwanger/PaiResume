package com.itwanger.pairesume.config;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class RealMySqlMigrationTest {

    @Test
    void emptyDatabaseMigratesThroughResumeReviewOssSchema() throws Exception {
        String url = System.getProperty("pairesume.test.mysql.url", "");
        String username = System.getProperty("pairesume.test.mysql.username", "");
        String password = System.getProperty("pairesume.test.mysql.password", "");
        assumeTrue(!url.isBlank() && !username.isBlank(),
                "real MySQL migration test is opt-in");

        Flyway flyway = Flyway.configure()
                .dataSource(url, username, password)
                .locations("classpath:db/migration")
                .baselineVersion("5")
                .baselineOnMigrate(true)
                .load();
        flyway.baseline();
        flyway.migrate();

        assertEquals("23",
                flyway.info().current().getVersion().getVersion());
        try (var connection = DriverManager.getConnection(url, username, password)) {
            assertTrue(tableExists(connection, "resume_review_upload"));
            assertTrue(columnExists(connection, "resume_review_request",
                    "pdf_object_key"));
            assertTrue(columnExists(connection, "resume_review_upload",
                    "final_object_key"));
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
}
