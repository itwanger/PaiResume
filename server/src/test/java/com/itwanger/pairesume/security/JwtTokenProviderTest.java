package com.itwanger.pairesume.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtTokenProviderTest {

    private static final String SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
    private JwtTokenProvider tokenProvider;

    @BeforeEach
    void setUp() {
        tokenProvider = new JwtTokenProvider(
                SECRET,
                60_000L,
                120_000L,
                "pai-resume-test",
                "pai-resume-test-web"
        );
    }

    @Test
    void accessAndRefreshTokensHaveStrictlySeparatedUses() {
        long beforeIssue = System.currentTimeMillis();
        String accessToken = tokenProvider.generateAccessToken(42L, "user@example.com", "USER", "session-1");
        long afterIssue = System.currentTimeMillis();
        String refreshToken = tokenProvider.generateRefreshToken(42L, "session-1");

        assertTrue(tokenProvider.validateAccessToken(accessToken));
        assertFalse(tokenProvider.validateRefreshToken(accessToken));
        assertTrue(tokenProvider.validateRefreshToken(refreshToken));
        assertFalse(tokenProvider.validateAccessToken(refreshToken));

        var accessClaims = tokenProvider.parseToken(accessToken);
        assertEquals("42", accessClaims.getSubject());
        assertEquals("USER", accessClaims.get(JwtTokenProvider.ROLE_CLAIM, String.class));
        assertEquals("session-1", tokenProvider.getSessionIdFromToken(accessToken));
        long issuedAtMillis = ((Number) accessClaims.get(JwtTokenProvider.ISSUED_AT_MILLIS_CLAIM)).longValue();
        assertTrue(issuedAtMillis >= beforeIssue);
        assertTrue(issuedAtMillis <= afterIssue);
        assertEquals(issuedAtMillis / 1000L, accessClaims.getIssuedAt().getTime() / 1000L);
    }

    @Test
    void tokenFromAnotherIssuerOrKeyIsRejected() {
        String token = tokenProvider.generateAccessToken(42L, "user@example.com", "USER", "session-1");
        JwtTokenProvider otherProvider = new JwtTokenProvider(
                "another-test-secret-that-is-longer-than-thirty-two-characters",
                60_000L,
                120_000L,
                "other-issuer",
                "pai-resume-test-web"
        );

        assertFalse(otherProvider.validateAccessToken(token));
    }

    @Test
    void qrOnlyAccessTokenDoesNotNeedOrExposeAFakeEmailClaim() {
        String token = tokenProvider.generateAccessToken(42L, null, "USER", "session-qr");

        assertTrue(tokenProvider.validateAccessToken(token));
        assertNull(tokenProvider.parseToken(token).get("email"));
    }
}
