package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ResumeReviewFollowRetirementMigrationTest {

    @Test
    void v22RevokesUnusedFollowCredentialsWithoutDeletingHistory() throws Exception {
        try (var connection = DriverManager.getConnection(
                "jdbc:h2:mem:resume_review_follow_retirement;MODE=MySQL;DB_CLOSE_DELAY=-1")) {
            try (var statement = connection.createStatement()) {
                statement.execute("""
                        CREATE TABLE resume_review_follow_challenge (
                            id BIGINT PRIMARY KEY,
                            challenge_status VARCHAR(16) NOT NULL,
                            active_user_key VARCHAR(64),
                            updated_at DATETIME NOT NULL
                        )
                        """);
                statement.execute("""
                        CREATE TABLE resume_review_follow_fallback_code (
                            id BIGINT PRIMARY KEY,
                            code_status VARCHAR(16) NOT NULL
                        )
                        """);
                statement.execute("""
                        CREATE TABLE platform_config (
                            resume_review_price_cents INT NOT NULL DEFAULT 0
                        )
                        """);
                statement.execute("""
                        INSERT INTO resume_review_follow_challenge
                            (id, challenge_status, active_user_key, updated_at)
                        VALUES
                            (1, 'ACTIVE', 'FOLLOW:7', CURRENT_TIMESTAMP),
                            (2, 'REDEEMED', NULL, CURRENT_TIMESTAMP)
                        """);
                statement.execute("""
                        INSERT INTO resume_review_follow_fallback_code (id, code_status)
                        VALUES (1, 'ISSUED'), (2, 'REDEEMED')
                        """);
            }

            ScriptUtils.executeSqlScript(connection,
                    new ClassPathResource("db/migration/V22__retire_resume_review_follow_flow.sql"));

            try (var statement = connection.createStatement()) {
                try (var result = statement.executeQuery("""
                        SELECT challenge_status, active_user_key
                        FROM resume_review_follow_challenge
                        WHERE id = 1
                        """)) {
                    result.next();
                    assertEquals("EXPIRED", result.getString("challenge_status"));
                    assertNull(result.getString("active_user_key"));
                }
                try (var result = statement.executeQuery("""
                        SELECT challenge_status
                        FROM resume_review_follow_challenge
                        WHERE id = 2
                        """)) {
                    result.next();
                    assertEquals("REDEEMED", result.getString("challenge_status"));
                }
                try (var result = statement.executeQuery("""
                        SELECT code_status
                        FROM resume_review_follow_fallback_code
                        ORDER BY id
                        """)) {
                    result.next();
                    assertEquals("REVOKED", result.getString("code_status"));
                    result.next();
                    assertEquals("REDEEMED", result.getString("code_status"));
                }
                statement.execute("INSERT INTO platform_config DEFAULT VALUES");
                try (var result = statement.executeQuery("""
                        SELECT resume_review_price_cents
                        FROM platform_config
                        """)) {
                    result.next();
                    assertEquals(0, result.getInt("resume_review_price_cents"));
                }
            }
        }
    }
}
