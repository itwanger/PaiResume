package com.itwanger.pairesume.security;

import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.UserMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    @Mock
    private StringRedisTemplate redisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;
    @Mock
    private UserMapper userMapper;
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
        filter = new JwtAuthenticationFilter(tokenProvider, redisTemplate, userMapper);
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
        when(userMapper.selectById(7L)).thenReturn(activeUser(true));
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
    void legalConsentRequiredBlocksProtectedApiBeforeAuthentication() throws Exception {
        when(redisTemplate.hasKey(anyString())).thenReturn(false);
        when(userMapper.selectById(7L)).thenReturn(activeUser(false));
        String accessToken = tokenProvider.generateAccessToken(7L, "user@example.com", "USER", "session-1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(bearerRequest(accessToken, "/resumes"), response, new MockFilterChain());

        assertEquals(403, response.getStatus());
        assertTrue(response.getContentAsString().contains("\"code\":1123"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void legalConsentRequiredStillAllowsConsentAndAccountDeletionApis() throws Exception {
        when(redisTemplate.hasKey(anyString())).thenReturn(false);
        when(userMapper.selectById(7L)).thenReturn(activeUser(false));
        String accessToken = tokenProvider.generateAccessToken(7L, "user@example.com", "USER", "session-1");

        filter.doFilter(
                bearerRequest(accessToken, "/auth/legal-consent"),
                new MockHttpServletResponse(),
                new MockFilterChain()
        );

        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        SecurityContextHolder.clearContext();

        filter.doFilter(
                bearerRequest(accessToken, "/auth/account"),
                new MockHttpServletResponse(),
                new MockFilterChain()
        );

        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
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

    @Test
    void credentialChangeInvalidatesPreviouslyIssuedAccessToken() throws Exception {
        when(redisTemplate.hasKey(anyString())).thenReturn(false);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("auth:credentials-changed:7"))
                .thenReturn(String.valueOf(System.currentTimeMillis() + 60_000L));
        String accessToken = tokenProvider.generateAccessToken(
                7L,
                "user@example.com",
                "USER",
                "session-1"
        );

        filter.doFilter(bearerRequest(accessToken), new MockHttpServletResponse(), new MockFilterChain());

        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void accessTokenIssuedAfterCredentialChangeInSameSecondRemainsValid() throws Exception {
        when(redisTemplate.hasKey(anyString())).thenReturn(false);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(userMapper.selectById(7L)).thenReturn(activeUser(true));

        String accessToken = tokenProvider.generateAccessToken(
                7L,
                "user@example.com",
                "USER",
                "session-1"
        );
        var claims = tokenProvider.parseToken(accessToken);
        long issuedAtMillis = ((Number) claims.get(JwtTokenProvider.ISSUED_AT_MILLIS_CLAIM)).longValue();
        while (issuedAtMillis % 1000L == 0L) {
            accessToken = tokenProvider.generateAccessToken(
                    7L,
                    "user@example.com",
                    "USER",
                    "session-1"
            );
            claims = tokenProvider.parseToken(accessToken);
            issuedAtMillis = ((Number) claims.get(JwtTokenProvider.ISSUED_AT_MILLIS_CLAIM)).longValue();
        }
        long credentialsChangedAt = issuedAtMillis - 1L;
        assertEquals(
                credentialsChangedAt / 1000L,
                claims.getIssuedAt().getTime() / 1000L,
                "test setup must keep both events inside the same JWT second"
        );
        when(valueOperations.get("auth:credentials-changed:7"))
                .thenReturn(String.valueOf(credentialsChangedAt));

        filter.doFilter(bearerRequest(accessToken), new MockHttpServletResponse(), new MockFilterChain());

        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
    }

    private MockHttpServletRequest bearerRequest(String token) {
        return bearerRequest(token, "/resumes");
    }

    private MockHttpServletRequest bearerRequest(String token, String servletPath) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setServletPath(servletPath);
        request.addHeader("Authorization", "Bearer " + token);
        return request;
    }

    private User activeUser(boolean legalConsentAccepted) {
        User user = new User();
        user.setId(7L);
        user.setStatus(1);
        if (legalConsentAccepted) {
            LocalDateTime acceptedAt = LocalDateTime.now();
            user.setTermsAcceptedAt(acceptedAt);
            user.setPrivacyAcceptedAt(acceptedAt);
            user.setTermsVersion(LegalConsentPolicy.CURRENT_VERSION);
            user.setPrivacyVersion(LegalConsentPolicy.CURRENT_VERSION);
            user.setAiProcessingDisclosureVersion(LegalConsentPolicy.CURRENT_VERSION);
        }
        return user;
    }
}
