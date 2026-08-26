package com.itwanger.pairesume.config;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class RealMySqlMigrationTest {

    @Test
    void emptyDatabaseMigratesThroughCurrentSchema() throws Exception {
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

        Flyway throughV31 = Flyway.configure()
                .dataSource(url, username, password)
                .locations("classpath:db/migration")
                .baselineVersion("5")
                .baselineOnMigrate(true)
                .target("31")
                .load();
        throughV31.migrate();

        assertEquals("31",
                throughV31.info().current().getVersion().getVersion());
        try (var connection = DriverManager.getConnection(url, username, password)) {
            assertTrue(columnExists(connection, "resume_showcase", "tags"));
            insertLegacyShowcaseAccessTypes(connection);
        }

        Flyway throughCurrent = Flyway.configure()
                .dataSource(url, username, password)
                .locations("classpath:db/migration")
                .baselineVersion("5")
                .baselineOnMigrate(true)
                .load();
        throughCurrent.migrate();

        assertEquals("41",
                throughCurrent.info().current().getVersion().getVersion());

        Flyway restart = Flyway.configure()
                .dataSource(url, username, password)
                .locations("classpath:db/migration")
                .baselineVersion("5")
                .baselineOnMigrate(true)
                .load();
        assertEquals(0, restart.migrate().migrationsExecuted,
                "已迁移到当前版本后再次执行迁移不应应用任何脚本");
        assertEquals("41",
                restart.info().current().getVersion().getVersion());

        try (var connection = DriverManager.getConnection(url, username, password)) {
            assertTrue(columnExists(connection, "resume_showcase",
                    "access_type"));
            assertFalse(columnExists(connection, "resume_showcase",
                    "tags"));
            assertShowcaseAccessType(connection, "legacy-free", "PUBLIC");
            assertShowcaseAccessType(connection, "legacy-vip", "PAID");
            assertShowcaseAccessType(connection, "featured-65", "PAID");
            assertTrue(columnExists(connection, "resume_showcase", "price_cents"));
            assertTrue(tableExists(connection, "showcase_purchase_order"));
            assertTrue(columnExists(connection, "resume_review_request", "base_price_cents"));
            assertTrue(columnExists(connection, "resume_review_request", "priority_fee_cents"));
            assertTrue(indexExists(connection, "resume_review_request", "idx_resume_review_priority_queue"));
            assertEquals("PUBLIC", columnDefault(
                    connection, "resume_showcase", "access_type"));
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
            assertTrue(tableExists(connection, "user_resume_profile"));
            assertTrue(tableExists(connection, "user_resume_material"));
            assertTrue(tableExists(connection, "official_resume_material"));
            assertTrue(tableExists(connection, "resume_content_template"));
            assertTrue(tableExists(connection, "resume_material_usage"));
            assertTrue(tableExists(connection, "resume_photo"));
            assertTrue(columnExists(connection, "resume_photo", "object_key"));
            assertTrue(columnExists(connection, "resume_photo", "sha256"));
            assertTrue(columnExists(connection, "resume_photo_oss_config",
                    "object_prefix"));
            assertEquals("pairesume", columnDefault(
                    connection, "resume_photo_oss_config", "object_prefix"));
            assertTrue(tableExists(connection, "resume_analysis_prompt_config"));
            assertTrue(columnExists(connection, "resume_analysis_record", "scenario_code"));
            assertTrue(indexExists(connection, "resume_analysis_record",
                    "idx_resume_analysis_scenario"));
            assertTrue(tableExists(connection, "ai_provider_config"));
            assertTrue(tableExists(connection, "ai_provider_config_audit"));
            assertTrue(columnExists(connection, "ai_provider_config", "provider_code"));
            assertEquals("DEEPSEEK", columnDefault(
                    connection, "ai_provider_config", "provider_code"));
            assertAiProviderSeedRow(connection);
            assertPromptSeedConfigs(connection);
            assertLegacyOrdersPreserved(connection);
        }
    }

    private void insertLegacyShowcaseAccessTypes(java.sql.Connection connection)
            throws Exception {
        try (var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO `resume_showcase` (
                        `resume_id`, `slug`, `score_label`, `summary`, `tags`,
                        `display_order`, `publish_status`, `access_type`
                    ) VALUES
                        (9101, 'legacy-free', 'Java 后端', '公开样例', JSON_ARRAY(), 0, 'PUBLISHED', 'FREE'),
                        (9102, 'legacy-vip', '产品经理', '历史付费样例', JSON_ARRAY(), 1, 'PUBLISHED', 'VIP'),
                        (65, 'featured-65', 'Agent 工程师', '指定公开样例', JSON_ARRAY(), 2, 'PUBLISHED', 'VIP')
                    """);
        }
    }

    private void assertShowcaseAccessType(
            java.sql.Connection connection,
            String slug,
            String expectedAccessType
    ) throws Exception {
        try (var statement = connection.prepareStatement("""
                SELECT `access_type`
                FROM `resume_showcase`
                WHERE `slug` = ?
                """)) {
            statement.setString(1, slug);
            try (var result = statement.executeQuery()) {
                assertTrue(result.next());
                assertEquals(expectedAccessType, result.getString("access_type"));
            }
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

    private void assertAiProviderSeedRow(java.sql.Connection connection) throws Exception {
        try (var statement = connection.createStatement();
             var result = statement.executeQuery("""
                     SELECT COUNT(*) AS total,
                            SUM(CASE WHEN `id` = 1 AND `enabled` = 0
                                 AND `api_key_cipher` IS NULL
                                 AND `provider_code` = 'DEEPSEEK'
                                 AND `display_name` = 'DeepSeek'
                                 AND `base_url` = 'https://api.deepseek.com'
                                 AND `general_model` = 'deepseek-v4-flash'
                                 AND `analysis_model` = 'deepseek-v4-flash'
                                 AND `privacy_policy_url` = 'https://cdn.deepseek.com/policies/zh-CN/deepseek-privacy-policy.html'
                                 THEN 1 ELSE 0 END) AS seed_ok
                     FROM `ai_provider_config`
                     """)) {
            assertTrue(result.next());
            assertEquals(1, result.getInt("total"), "ai_provider_config 应只有一行");
            assertEquals(1, result.getInt("seed_ok"), "种子行必须关闭启用且不带密钥");
        }
    }

    private boolean indexExists(java.sql.Connection connection, String table,
                                String indexName) throws Exception {
        try (var result = connection.getMetaData().getIndexInfo(
                connection.getCatalog(), null, table, false, false)) {
            while (result.next()) {
                if (indexName.equals(result.getString("INDEX_NAME"))) {
                    return true;
                }
            }
            return false;
        }
    }

    private void assertPromptSeedConfigs(java.sql.Connection connection) throws Exception {
        try (var statement = connection.createStatement();
             var result = statement.executeQuery("""
                     SELECT `scenario_code`, `display_name`, `prompt`, `sort_order`, `updated_by`
                     FROM `resume_analysis_prompt_config`
                     ORDER BY `sort_order`
                     """)) {
            String[] expectedCodes = {
                    "WORKING_PROFESSIONAL",
                    "STUDENT_DAILY_INTERNSHIP",
                    "STUDENT_SUMMER_INTERNSHIP",
                    "STUDENT_AUTUMN_RECRUITMENT"
            };
            String[] expectedNames = {"工作党", "学生党找日常实习", "学生党找暑期实习", "学生党冲秋招"};
            for (int i = 0; i < expectedCodes.length; i++) {
                assertTrue(result.next(), "resume_analysis_prompt_config 应有四条种子数据");
                assertEquals(expectedCodes[i], result.getString("scenario_code"));
                assertEquals(expectedNames[i], result.getString("display_name"));
                assertFalse(result.getString("prompt").isBlank(),
                        expectedCodes[i] + " 的种子 Prompt 不能为空");
                assertNull(result.getObject("updated_by"),
                        "种子数据不应被标记为管理员更新");
            }
            assertFalse(result.next(), "resume_analysis_prompt_config 不应有多余种子数据");
        }
    }

    private void assertLegacyOrdersPreserved(java.sql.Connection connection) throws Exception {
        try (var statement = connection.prepareStatement("""
                SELECT `user_id`, `order_status`, `payable_amount_cents`, `currency`
                FROM `membership_payment_order`
                WHERE `order_no` IN ('PM-legacy-annual', 'PM-legacy-thirty')
                """)) {
            int checked = 0;
            try (var result = statement.executeQuery()) {
                while (result.next()) {
                    checked++;
                    assertEquals(9001, result.getLong("user_id"));
                    assertEquals("CANCELED", result.getString("order_status"));
                    assertEquals(6600, result.getInt("payable_amount_cents"));
                    assertEquals("CNY", result.getString("currency"));
                }
            }
            assertEquals(2, checked, "两条历史会员订单都应保留");
        }
    }

    private String testSetting(String propertyName, String environmentName) {
        String propertyValue = System.getProperty(propertyName, "");
        return propertyValue.isBlank()
                ? System.getenv().getOrDefault(environmentName, "")
                : propertyValue;
    }
}
