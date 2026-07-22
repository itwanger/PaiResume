package com.itwanger.pairesume.controller;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class HealthController {

    private final JdbcTemplate jdbcTemplate;
    private final StringRedisTemplate redisTemplate;
    private final String mailUsername;
    private final String mailPassword;
    private final String mailFrom;

    public HealthController(
            JdbcTemplate jdbcTemplate,
            StringRedisTemplate redisTemplate,
            @Value("${spring.mail.username:}") String mailUsername,
            @Value("${spring.mail.password:}") String mailPassword,
            @Value("${app.mail.from:}") String mailFrom
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.redisTemplate = redisTemplate;
        this.mailUsername = mailUsername;
        this.mailPassword = mailPassword;
        this.mailFrom = mailFrom;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("status", "UP");
    }

    @GetMapping("/ready")
    public ResponseEntity<Map<String, Object>> ready() {
        var checks = new LinkedHashMap<String, Object>();

        try {
            jdbcTemplate.queryForObject("SELECT COUNT(*) FROM `user_auth_identity`", Long.class);
            checks.put("mysql", "UP");
        } catch (Exception exception) {
            checks.put("mysql", "DOWN");
        }

        try {
            var redisStatus = redisTemplate.execute((RedisCallback<String>) connection -> connection.ping());
            checks.put("redis", "PONG".equalsIgnoreCase(redisStatus) ? "UP" : "DOWN");
        } catch (Exception exception) {
            checks.put("redis", "DOWN");
        }

        boolean mailConfigured = StringUtils.hasText(mailUsername)
                && StringUtils.hasText(mailPassword)
                && StringUtils.hasText(mailFrom);
        checks.put("mailConfiguration", mailConfigured ? "UP" : "DOWN");

        var allReady = checks.values().stream().allMatch("UP"::equals);
        var body = new LinkedHashMap<String, Object>();
        body.put("status", allReady ? "UP" : "DOWN");
        body.put("checks", checks);

        return ResponseEntity.status(allReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }
}
