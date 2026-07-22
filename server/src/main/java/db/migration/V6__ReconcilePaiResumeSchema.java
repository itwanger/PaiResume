package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import java.io.IOException;
import java.util.zip.CRC32;

/**
 * Baselines both empty databases and installations created before Flyway was introduced.
 * Bump MIGRATION_REVISION if the Java upgrade logic changes after release.
 */
public class V6__ReconcilePaiResumeSchema extends BaseJavaMigration {

    private static final Logger log = LoggerFactory.getLogger(V6__ReconcilePaiResumeSchema.class);
    private static final String SCHEMA_RESOURCE = "schema.sql";
    private static final int MIGRATION_REVISION = 1;

    @Override
    public Integer getChecksum() {
        CRC32 checksum = new CRC32();
        try (var input = new ClassPathResource(SCHEMA_RESOURCE).getInputStream()) {
            input.transferTo(new java.io.OutputStream() {
                @Override
                public void write(int value) {
                    checksum.update(value);
                }

                @Override
                public void write(byte[] bytes, int offset, int length) {
                    checksum.update(bytes, offset, length);
                }
            });
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to checksum " + SCHEMA_RESOURCE, exception);
        }
        checksum.update(MIGRATION_REVISION);
        return (int) checksum.getValue();
    }

    @Override
    public void migrate(Context context) {
        ScriptUtils.executeSqlScript(
                context.getConnection(),
                new ClassPathResource(SCHEMA_RESOURCE)
        );
        var dataSource = new SingleConnectionDataSource(context.getConnection(), true);
        var jdbcTemplate = new JdbcTemplate(dataSource);

        migrateUserMembershipColumns(jdbcTemplate);
        migrateAiOptimizeRecordStatusColumn(jdbcTemplate);
        ensurePlatformConfigRow(jdbcTemplate);
        backfillEmailPasswordIdentities(jdbcTemplate);
        ensureAuthIdentityForeignKey(jdbcTemplate);
        log.info("PaiResume schema migration completed");
    }

    private void migrateUserMembershipColumns(JdbcTemplate jdbcTemplate) {
        ensureColumn(
                jdbcTemplate,
                "user",
                "membership_status",
                "ALTER TABLE `user` ADD COLUMN `membership_status` VARCHAR(16) NOT NULL DEFAULT 'FREE' COMMENT '会员状态: FREE/ACTIVE' AFTER `status`"
        );
        ensureColumn(
                jdbcTemplate,
                "user",
                "membership_granted_at",
                "ALTER TABLE `user` ADD COLUMN `membership_granted_at` DATETIME NULL COMMENT '会员开通时间' AFTER `membership_status`"
        );
        ensureColumn(
                jdbcTemplate,
                "user",
                "membership_source",
                "ALTER TABLE `user` ADD COLUMN `membership_source` VARCHAR(32) NULL COMMENT '会员来源: ADMIN_GRANTED/PAYMENT' AFTER `membership_granted_at`"
        );
        ensureColumn(
                jdbcTemplate,
                "user",
                "membership_expires_at",
                "ALTER TABLE `user` ADD COLUMN `membership_expires_at` DATETIME NULL COMMENT '会员到期时间，永久会员为空' AFTER `membership_source`"
        );
    }

    private void migrateAiOptimizeRecordStatusColumn(JdbcTemplate jdbcTemplate) {
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
    }

    private void ensurePlatformConfigRow(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.execute("""
                INSERT INTO `platform_config` (`id`, `membership_price_cents`, `questionnaire_coupon_amount_cents`)
                VALUES (1, 6600, 1000)
                ON DUPLICATE KEY UPDATE `id` = `id`
                """);
    }

    private void backfillEmailPasswordIdentities(JdbcTemplate jdbcTemplate) {
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
    }

    private void ensureAuthIdentityForeignKey(JdbcTemplate jdbcTemplate) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
                WHERE CONSTRAINT_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'user_auth_identity'
                  AND CONSTRAINT_NAME = 'fk_user_auth_identity_user'
                """, Integer.class);
        if (count == null || count == 0) {
            jdbcTemplate.execute("""
                    ALTER TABLE `user_auth_identity`
                    ADD CONSTRAINT `fk_user_auth_identity_user`
                    FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
                    """);
        }
    }

    private void ensureColumn(
            JdbcTemplate jdbcTemplate,
            String tableName,
            String columnName,
            String alterSql
    ) {
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
    }
}
