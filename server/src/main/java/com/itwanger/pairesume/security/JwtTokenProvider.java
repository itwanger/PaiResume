package com.itwanger.pairesume.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

@Component
public class JwtTokenProvider {

    public static final String TOKEN_USE_CLAIM = "token_use";
    public static final String TOKEN_USE_ACCESS = "access";
    public static final String TOKEN_USE_REFRESH = "refresh";
    public static final String ROLE_CLAIM = "role";
    public static final String SESSION_ID_CLAIM = "sid";
    public static final String ISSUED_AT_MILLIS_CLAIM = "iat_ms";

    private final SecretKey key;
    private final long accessTokenExpiration;
    private final long refreshTokenExpiration;
    private final String issuer;
    private final String audience;

    public JwtTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.access-token-expiration}") long accessTokenExpiration,
            @Value("${jwt.refresh-token-expiration}") long refreshTokenExpiration,
            @Value("${jwt.issuer:pai-resume}") String issuer,
            @Value("${jwt.audience:pai-resume-web}") String audience
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpiration = accessTokenExpiration;
        this.refreshTokenExpiration = refreshTokenExpiration;
        this.issuer = issuer;
        this.audience = audience;
    }

    public String generateAccessToken(Long userId, String email, String role, String sessionId) {
        var now = new Date();
        return Jwts.builder()
                .issuer(issuer)
                .audience().add(audience).and()
                .subject(String.valueOf(userId))
                .claim("email", email)
                .claim(TOKEN_USE_CLAIM, TOKEN_USE_ACCESS)
                .claim(ROLE_CLAIM, role)
                .claim(SESSION_ID_CLAIM, sessionId)
                .claim(ISSUED_AT_MILLIS_CLAIM, now.getTime())
                .id(UUID.randomUUID().toString())
                .issuedAt(now)
                .expiration(new Date(now.getTime() + accessTokenExpiration))
                .signWith(key)
                .compact();
    }

    public String generateRefreshToken(Long userId, String sessionId) {
        var now = new Date();
        return Jwts.builder()
                .issuer(issuer)
                .audience().add(audience).and()
                .subject(String.valueOf(userId))
                .claim(TOKEN_USE_CLAIM, TOKEN_USE_REFRESH)
                .claim(SESSION_ID_CLAIM, sessionId)
                .id(UUID.randomUUID().toString())
                .issuedAt(now)
                .expiration(new Date(now.getTime() + refreshTokenExpiration))
                .signWith(key)
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .requireIssuer(issuer)
                .requireAudience(audience)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Long getUserIdFromToken(String token) {
        return Long.parseLong(parseToken(token).getSubject());
    }

    public String getJtiFromToken(String token) {
        return parseToken(token).getId();
    }

    public Date getExpirationFromToken(String token) {
        return parseToken(token).getExpiration();
    }

    public String getSessionIdFromToken(String token) {
        return parseToken(token).get(SESSION_ID_CLAIM, String.class);
    }

    public boolean validateToken(String token) {
        try {
            parseToken(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public boolean validateAccessToken(String token) {
        return validateTokenForUse(token, TOKEN_USE_ACCESS);
    }

    public boolean validateRefreshToken(String token) {
        return validateTokenForUse(token, TOKEN_USE_REFRESH);
    }

    private boolean validateTokenForUse(String token, String expectedUse) {
        try {
            Claims claims = parseToken(token);
            String sessionId = claims.get(SESSION_ID_CLAIM, String.class);
            return expectedUse.equals(claims.get(TOKEN_USE_CLAIM, String.class))
                    && sessionId != null
                    && !sessionId.isBlank();
        } catch (JwtException | IllegalArgumentException exception) {
            return false;
        }
    }
}
