package com.itwanger.pairesume.mapper;

import org.apache.ibatis.annotations.Select;
import org.junit.jupiter.api.Test;

import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ResumeReviewRequestMapperSqlTest {

    @Test
    void publicQueueStartsAfterSmtpAndOrdersWaitingByPriorityAndQueueTime() throws Exception {
        Select select = ResumeReviewRequestMapper.class
                .getMethod("selectPublicQueue")
                .getAnnotation(Select.class);
        String sql = String.join(" ", select.value());

        try (var connection = DriverManager.getConnection(
                "jdbc:h2:mem:resume_review_public_queue;MODE=MySQL;DB_CLOSE_DELAY=-1");
             var statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE resume_review_request (
                        id BIGINT PRIMARY KEY,
                        request_status VARCHAR(24) NOT NULL,
                        payment_status VARCHAR(24),
                        priority_fee_cents INT NOT NULL,
                        paid_at TIMESTAMP,
                        queued_at TIMESTAMP,
                        accepted_at TIMESTAMP
                    )
                    """);
            statement.execute("""
                    INSERT INTO resume_review_request VALUES
                        (1, 'ACCEPTED', 'PAID', 0, NULL, TIMESTAMP '2026-08-25 09:00:00', TIMESTAMP '2026-08-25 09:05:00'),
                        (2, 'EMAILED', 'PAID', 1000, TIMESTAMP '2026-08-25 09:03:00', TIMESTAMP '2026-08-25 09:10:00', NULL),
                        (3, 'EMAILED', 'PAID', 3000, TIMESTAMP '2026-08-25 09:20:00', TIMESTAMP '2026-08-25 09:20:00', NULL),
                        (4, 'EMAIL_PENDING', 'PAID', 1000, TIMESTAMP '2026-08-25 09:00:00', TIMESTAMP '2026-08-25 09:00:00', NULL),
                        (5, 'COMPLETED', 'PAID', 9000, TIMESTAMP '2026-08-25 08:00:00', TIMESTAMP '2026-08-25 08:00:00', NULL),
                        (6, 'EMAILED', NULL, 0, NULL, TIMESTAMP '2026-08-25 08:00:00', NULL),
                        (7, 'EMAILED', 'PAID', 1000, TIMESTAMP '2026-08-25 09:04:00', TIMESTAMP '2026-08-25 09:01:00', NULL)
                    """);

            List<Long> ids = new ArrayList<>();
            try (var resultSet = statement.executeQuery(sql)) {
                while (resultSet.next()) ids.add(resultSet.getLong("id"));
            }
            assertEquals(List.of(1L, 3L, 2L, 7L, 6L), ids);
        }
    }

    @Test
    void adminActionCountReadsMailStateFromTheOutboxTable() throws Exception {
        Select select = ResumeReviewRequestMapper.class
                .getMethod("countAdminActionQueue")
                .getAnnotation(Select.class);
        String sql = String.join(" ", select.value());

        try (var connection = DriverManager.getConnection(
                "jdbc:h2:mem:resume_review_admin_count;MODE=MySQL;DB_CLOSE_DELAY=-1");
             var statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE resume_review_request (
                        id BIGINT PRIMARY KEY,
                        request_status VARCHAR(24) NOT NULL
                    )
                    """);
            statement.execute("""
                    CREATE TABLE resume_review_mail_outbox (
                        id BIGINT PRIMARY KEY,
                        request_id BIGINT NOT NULL UNIQUE,
                        outbox_status VARCHAR(16) NOT NULL
                    )
                    """);
            statement.execute("""
                    INSERT INTO resume_review_request (id, request_status) VALUES
                        (1, 'EMAILED'),
                        (2, 'EMAIL_PENDING'),
                        (3, 'EMAIL_PENDING'),
                        (4, 'EMAIL_PENDING'),
                        (5, 'COMPLETED')
                    """);
            statement.execute("""
                    INSERT INTO resume_review_mail_outbox (id, request_id, outbox_status) VALUES
                        (31, 3, 'FAILED'),
                        (41, 4, 'SENT')
                    """);

            try (var resultSet = statement.executeQuery(sql)) {
                resultSet.next();
                assertEquals(2L, resultSet.getLong(1));
            }
        }
    }
}
