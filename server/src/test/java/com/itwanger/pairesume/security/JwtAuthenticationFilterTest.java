package com.itwanger.pairesume.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    @Mock
    private StringRedisTemplate redisTemplate;
    private JwtTokenProvider tokenProvider;
    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        tokenProvider = new JwtTokenProvider(
                "test-secret-that-is-longer-than-thirty-two-characters",
                60_000L,
                120_000L,
                "pai-resume-test",
                "pai-resume-test-web"
        );
        filter = new JwtAuthenticationFilter(tokenProvider, redisTemplate);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void refreshTokenNeverAuthenticatesAProtectedRequest() throws Exception {
        String refreshToken = tokenProvider.generateRefreshToken(7L, "session-1");
        MockHttpServletRequest request = bearerRequest(refreshToken);

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void nonRevokedAccessTokenAuthenticatesWithItsRole() throws Exception {
        when(redisTemplate.hasKey(anyString())).thenReturn(false);
        String accessToken = tokenProvider.generateAccessToken(7L, "user@example.com", "USER", "session-1");
        MockHttpServletRequest request = bearerRequest(accessToken);

        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        var authentication = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(authentication);
        assertEquals(7L, authentication.getPrincipal());
        assertTrue(authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_USER".equals(authority.getAuthority())));
    }

    @Test
    void revokedSessionInvalidatesEveryAccessTokenInTheFamily() throws Exception {
        when(redisTemplate.hasKey(anyString())).thenAnswer(invocation ->
                ((String) invocation.getArgument(0)).startsWith("refresh:revoked:7:session-1")
        );
        String accessToken = tokenProvider.generateAccessToken(
                7L,
                "user@example.com",
                "USER",
                "session-1"
        );

        filter.doFilter(bearerRequest(accessToken), new MockHttpServletResponse(), new MockFilterChain());

        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    private MockHttpServletRequest bearerRequest(String token) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + token);
        return request;
    }
}
