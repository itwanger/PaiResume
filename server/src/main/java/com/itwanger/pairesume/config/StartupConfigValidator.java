package com.itwanger.pairesume.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class StartupConfigValidator {

    private static final String DEFAULT_JWT_SECRET =
            "dGhpcyBpcyBhIHZlcnkgc2VjdXJlIGtleSBmb3IgcGFpIHJlc3VtZSBqd3QgdG9rZW4gZ2VuZXJhdGlvbiBhbmQgdmFsaWRhdGlvbiBwdXJwb3Nl";

    @Value("${app.environment:development}")
    private String appEnvironment;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @PostConstruct
    public void validate() {
        if (!"development".equalsIgnoreCase(appEnvironment) && DEFAULT_JWT_SECRET.equals(jwtSecret)) {
            throw new IllegalStateException("JWT_SECRET must be overridden outside development environment");
        }
    }
}
