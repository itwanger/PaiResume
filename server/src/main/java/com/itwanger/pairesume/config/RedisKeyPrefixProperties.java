package com.itwanger.pairesume.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.regex.Pattern;

@Data
@ConfigurationProperties(prefix = "app.redis")
public class RedisKeyPrefixProperties {

    static final String DEVELOPMENT_PREFIX = "pairesume:dev:";
    static final String PRODUCTION_PREFIX = "pairesume:prod:";
    private static final Pattern SAFE_PREFIX =
            Pattern.compile("[A-Za-z0-9][A-Za-z0-9:_-]{1,62}:");

    private String keyPrefix = DEVELOPMENT_PREFIX;

    String validatedPrefix(String environment) {
        if (!StringUtils.hasText(keyPrefix)
                || !keyPrefix.equals(keyPrefix.trim())
                || !SAFE_PREFIX.matcher(keyPrefix).matches()) {
            throw new IllegalStateException(
                    "REDIS_KEY_PREFIX must be an explicit ASCII namespace ending with ':'"
            );
        }

        String normalizedEnvironment = environment == null
                ? "" : environment.trim().toLowerCase(Locale.ROOT);
        if ("production".equals(normalizedEnvironment) && !PRODUCTION_PREFIX.equals(keyPrefix)) {
            throw new IllegalStateException(
                    "Production Redis keys require REDIS_KEY_PREFIX=" + PRODUCTION_PREFIX
            );
        }
        return keyPrefix;
    }
}
