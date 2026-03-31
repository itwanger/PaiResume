package com.itwanger.pairesume.controller;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class HealthController {

    private final JdbcTemplate jdbcTemplate;
    private final StringRedisTemplate redisTemplate;

    public HealthController(JdbcTemplate jdbcTemplate, StringRedisTemplate redisTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.redisTemplate = redisTemplate;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("status", "UP");
    }

    @GetMapping("/ready")
    public ResponseEntity<Map<String, Object>> ready() {
        var checks = new LinkedHashMap<String, Object>();

        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
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

        var allReady = checks.values().stream().allMatch("UP"::equals);
        var body = new LinkedHashMap<String, Object>();
        body.put("status", allReady ? "UP" : "DOWN");
        body.put("checks", checks);

        return ResponseEntity.status(allReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }
}
