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
    void emptyDatabaseMigratesThroughMembershipPlanSchema() throws Exception {
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
            insertLegacyMembershipOrders(connection);
        }

        Flyway throughV25 = Flyway.configure()
                .dataSource(url, username, password)
                .locations("classpath:db/migration")
                .baselineVersion("5")
                .baselineOnMigrate(true)
                .load();
        throughV25.migrate();

        assertEquals("25",
                throughV25.info().current().getVersion().getVersion());
        try (var connection = DriverManager.getConnection(url, username, password)) {
            assertTrue(columnExists(connection, "resume_showcase",
                    "access_type"));
            assertTrue(tableExists(connection, "membership_plan"));
            assertTrue(columnExists(connection, "membership_payment_order",
                    "plan_code"));
            assertTrue(columnExists(connection, "membership_payment_order",
                    "entitlement_type"));
            assertLegacyOrderBackfill(connection, "PM-legacy-annual",
                    "ANNUAL", "年卡", 365);
            assertLegacyOrderBackfill(connection, "PM-legacy-thirty",
                    "LEGACY_FIXED_DAYS", "历史会员（30 天）", 30);
            assertTrue(columnIsNullable(connection, "membership_payment_order",
                    "membership_days"));
            assertEquals("ANNUAL", columnDefault(
                    connection, "membership_payment_order", "plan_code"));
            assertEquals("年卡", columnDefault(
                    connection, "membership_payment_order", "plan_name_snapshot"));
            assertEquals("FIXED_DAYS", columnDefault(
                    connection, "membership_payment_order", "entitlement_type"));
        }
    }

    private void insertLegacyMembershipOrders(java.sql.Connection connection)
            throws Exception {
        try (var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO `user` (
                        `id`, `email`, `password`, `nickname`, `avatar`, `role`, `status`
                    )
                    VALUES (
                        9001, 'migration-v25@example.com', 'not-a-real-password',
                        'migration', '', 0, 1
                    )
                    """);
            statement.executeUpdate(legacyOrderInsert("PM-legacy-annual", "migration-v25-annual", 365));
            statement.executeUpdate(legacyOrderInsert("PM-legacy-thirty", "migration-v25-thirty", 30));
        }
    }

    private String legacyOrderInsert(String orderNo, String idempotencyKey, int days) {
        return """
                INSERT INTO `membership_payment_order` (
                    `order_no`, `user_id`, `idempotency_key`, `active_order_key`,
                    `membership_days`, `list_price_cents`, `discount_amount_cents`,
                    `payable_amount_cents`, `currency`, `provider`, `pay_channel`,
                    `order_status`, `expires_at`
                )
                VALUES (
                    '%s', 9001, '%s', NULL,
                    %d, 6600, 0, 6600, 'CNY', 'wechat-native', 'WECHAT_NATIVE',
                    'CANCELED', NOW()
                )
                """.formatted(orderNo, idempotencyKey, days);
    }

    private void assertLegacyOrderBackfill(
            java.sql.Connection connection,
            String orderNo,
            String expectedPlanCode,
            String expectedPlanName,
            int expectedDays
    ) throws Exception {
        try (var statement = connection.prepareStatement("""
                SELECT `plan_code`, `plan_name_snapshot`, `entitlement_type`, `membership_days`
                FROM `membership_payment_order`
                WHERE `order_no` = ?
                """)) {
            statement.setString(1, orderNo);
            try (var result = statement.executeQuery()) {
                assertTrue(result.next());
                assertEquals(expectedPlanCode, result.getString("plan_code"));
                assertEquals(expectedPlanName, result.getString("plan_name_snapshot"));
                assertEquals("FIXED_DAYS", result.getString("entitlement_type"));
                assertEquals(expectedDays, result.getInt("membership_days"));
            }
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

    private boolean columnIsNullable(
            java.sql.Connection connection,
            String table,
            String column
    ) throws Exception {
        try (var result = connection.getMetaData().getColumns(
                connection.getCatalog(), null, table, column)) {
            return result.next() && "YES".equals(result.getString("IS_NULLABLE"));
        }
    }

    private String columnDefault(
            java.sql.Connection connection,
            String table,
            String column
    ) throws Exception {
        try (var result = connection.getMetaData().getColumns(
                connection.getCatalog(), null, table, column)) {
            return result.next() ? result.getString("COLUMN_DEF") : null;
        }
    }

    private String testSetting(String propertyName, String environmentName) {
        String propertyValue = System.getProperty(propertyName, "");
        return propertyValue.isBlank()
                ? System.getenv().getOrDefault(environmentName, "")
                : propertyValue;
    }
}
