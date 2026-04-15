package com.itwanger.pairesume.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;

/**
 * 启动时自动执行 schema.sql 建表（IF NOT EXISTS，可安全重复执行）。
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class SchemaInitializer implements ApplicationRunner {

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            ScriptUtils.executeSqlScript(connection,
                    new org.springframework.core.io.ClassPathResource("schema.sql"));
            migrateUserMembershipColumns();
            migrateAiOptimizeRecordStatusColumn();
            ensurePlatformConfigRow();
            backfillEmailPasswordIdentities();
            log.info("Schema initialized successfully");
        }
    }

    private void migrateUserMembershipColumns() {
        ensureColumn(
                "user",
                "membership_status",
                "ALTER TABLE `user` ADD COLUMN `membership_status` VARCHAR(16) NOT NULL DEFAULT 'FREE' COMMENT '会员状态: FREE/ACTIVE' AFTER `status`"
        );
        ensureColumn(
                "user",
                "membership_granted_at",
                "ALTER TABLE `user` ADD COLUMN `membership_granted_at` DATETIME NULL COMMENT '会员开通时间' AFTER `membership_status`"
        );
        ensureColumn(
                "user",
                "membership_source",
                "ALTER TABLE `user` ADD COLUMN `membership_source` VARCHAR(32) NULL COMMENT '会员来源: ADMIN_GRANTED/PAYMENT' AFTER `membership_granted_at`"
        );
        ensureColumn(
                "user",
                "membership_expires_at",
                "ALTER TABLE `user` ADD COLUMN `membership_expires_at` DATETIME NULL COMMENT '会员到期时间，永久会员为空' AFTER `membership_source`"
        );
    }

    private void migrateAiOptimizeRecordStatusColumn() {
        try {
            Integer legacyStatusCount = jdbcTemplate.queryForObject("""
                    SELECT COUNT(*)
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'ai_optimize_record'
                      AND COLUMN_NAME = 'status'
                    """, Integer.class);
            Integer recordStatusCount = jdbcTemplate.queryForObject("""
                    SELECT COUNT(*)
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'ai_optimize_record'
                      AND COLUMN_NAME = 'record_status'
                    """, Integer.class);

            if (legacyStatusCount != null && legacyStatusCount > 0
                    && (recordStatusCount == null || recordStatusCount == 0)) {
                jdbcTemplate.execute("""
                        ALTER TABLE `ai_optimize_record`
                        CHANGE COLUMN `status` `record_status` VARCHAR(16) NOT NULL COMMENT '状态: completed/error'
                        """);
                log.info("Migrated ai_optimize_record.status to record_status");
            }
        } catch (Exception e) {
            log.warn("Failed to migrate ai_optimize_record status column", e);
        }
    }

    private void ensurePlatformConfigRow() {
        try {
            jdbcTemplate.execute("""
                    INSERT INTO `platform_config` (`id`, `membership_price_cents`, `questionnaire_coupon_amount_cents`)
                    VALUES (1, 6600, 1000)
                    ON DUPLICATE KEY UPDATE `id` = `id`
                    """);
        } catch (Exception e) {
            log.warn("Failed to ensure platform_config default row", e);
        }
    }

    private void backfillEmailPasswordIdentities() {
        try {
            jdbcTemplate.execute("""
                    INSERT INTO `user_auth_identity` (
                        `user_id`, `provider`, `principal`, `credential_hash`, `verified_at`, `status`, `last_login_at`
                    )
                    SELECT
                        u.`id`,
                        'EMAIL_PASSWORD',
                        LOWER(u.`email`),
                        u.`password`,
                        COALESCE(u.`created_at`, NOW()),
                        1,
                        NULL
                    FROM `user` u
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM `user_auth_identity` a
                        WHERE a.`user_id` = u.`id`
                          AND a.`provider` = 'EMAIL_PASSWORD'
                    )
                    """);
        } catch (Exception e) {
            log.warn("Failed to backfill email identities", e);
        }
    }

    private void ensureColumn(String tableName, String columnName, String alterSql) {
        try {
            Integer count = jdbcTemplate.queryForObject("""
                    SELECT COUNT(*)
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = ?
                      AND COLUMN_NAME = ?
                    """, Integer.class, tableName, columnName);
            if (count == null || count == 0) {
                jdbcTemplate.execute(alterSql);
                log.info("Added {}.{} column", tableName, columnName);
            }
        } catch (Exception e) {
            log.warn("Failed to ensure {}.{} column", tableName, columnName, e);
        }
    }
}
