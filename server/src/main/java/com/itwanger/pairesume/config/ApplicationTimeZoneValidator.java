package com.itwanger.pairesume.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.ZoneId;

@Component
public class ApplicationTimeZoneValidator {
    private final String configuredTimeZone;
    private final String connectionInitSql;

    public ApplicationTimeZoneValidator(
            @Value("${app.time-zone:Asia/Shanghai}") String configuredTimeZone,
            @Value("${spring.datasource.hikari.connection-init-sql:}") String connectionInitSql
    ) {
        this.configuredTimeZone = configuredTimeZone;
        this.connectionInitSql = connectionInitSql;
    }

    @PostConstruct
    public void validate() {
        if (!ApplicationTimeZone.ID.equals(configuredTimeZone == null ? null : configuredTimeZone.trim())) {
            throw new IllegalStateException("APP_TIME_ZONE must be Asia/Shanghai");
        }
        if (!ApplicationTimeZone.ZONE_ID.equals(ZoneId.systemDefault())) {
            throw new IllegalStateException(
                    "PaiResume JVM default time zone must be Asia/Shanghai before Spring starts"
            );
        }
        if (!"SET time_zone = '+08:00'".equals(connectionInitSql == null ? null : connectionInitSql.trim())) {
            throw new IllegalStateException(
                    "MySQL sessions must initialize with SET time_zone = '+08:00'"
            );
        }
    }
}
