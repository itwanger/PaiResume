package com.itwanger.pairesume.mapper;

import org.apache.ibatis.annotations.Select;
import org.junit.jupiter.api.Test;

import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ResumeReviewRequestMapperSqlTest {

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
                assertEquals(3L, resultSet.getLong(1));
            }
        }
    }
}
