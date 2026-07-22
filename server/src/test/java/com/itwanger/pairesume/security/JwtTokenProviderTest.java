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
        String accessToken = tokenProvider.generateAccessToken(42L, "user@example.com", "USER", "session-1");
        String refreshToken = tokenProvider.generateRefreshToken(42L, "session-1");

        assertTrue(tokenProvider.validateAccessToken(accessToken));
        assertFalse(tokenProvider.validateRefreshToken(accessToken));
        assertTrue(tokenProvider.validateRefreshToken(refreshToken));
        assertFalse(tokenProvider.validateAccessToken(refreshToken));

        var accessClaims = tokenProvider.parseToken(accessToken);
        assertEquals("42", accessClaims.getSubject());
        assertEquals("USER", accessClaims.get(JwtTokenProvider.ROLE_CLAIM, String.class));
        assertEquals("session-1", tokenProvider.getSessionIdFromToken(accessToken));
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
}
