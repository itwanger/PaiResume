package com.itwanger.pairesume.security;

import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.mapper.UserMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final StringRedisTemplate redisTemplate;
    private final UserMapper userMapper;

    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider, StringRedisTemplate redisTemplate,
                                   UserMapper userMapper) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.redisTemplate = redisTemplate;
        this.userMapper = userMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        var token = resolveToken(request);

        if (token != null && jwtTokenProvider.validateAccessToken(token)) {
            var claims = jwtTokenProvider.parseToken(token);
            var jti = claims.getId();
            var userId = Long.parseLong(claims.getSubject());
            var sessionId = claims.get(JwtTokenProvider.SESSION_ID_CLAIM, String.class);
            var isBlacklisted = Boolean.TRUE.equals(redisTemplate.hasKey("blacklist:" + jti));
            var isSessionRevoked = Boolean.TRUE.equals(redisTemplate.hasKey(
                    "refresh:revoked:" + userId + ":" + sessionId
            ));
            var isAccountDisabled = Boolean.TRUE.equals(redisTemplate.hasKey(
                    "auth:account-disabled:" + userId
            ));
            var valueOperations = redisTemplate.opsForValue();
            var credentialsChangedAt = valueOperations == null
                    ? null
                    : valueOperations.get("auth:credentials-changed:" + userId);
            var issuedAt = claims.getIssuedAt();
            var issuedAtMillisClaim = claims.get(JwtTokenProvider.ISSUED_AT_MILLIS_CLAIM);
            Long issuedAtMillis = issuedAtMillisClaim instanceof Number number
                    ? Long.valueOf(number.longValue())
                    : issuedAt == null ? null : Long.valueOf(issuedAt.getTime());
            var issuedBeforeCredentialChange = credentialsChangedAt != null
                    && issuedAtMillis != null
                    && issuedAtMillis < parseEpochMillis(credentialsChangedAt);

            if (!isBlacklisted && !isSessionRevoked && !isAccountDisabled && !issuedBeforeCredentialChange) {
                var user = userMapper.selectById(userId);
                if (user == null || user.getStatus() == null || user.getStatus() == 0
                        || user.getAccountDeletedAt() != null) {
                    filterChain.doFilter(request, response);
                    return;
                }
                if (LegalConsentPolicy.isRequired(user) && !isLegalConsentExempt(request)) {
                    writeLegalConsentRequired(response);
                    return;
                }
                var email = claims.get("email", String.class);
                var role = claims.get(JwtTokenProvider.ROLE_CLAIM, String.class);

                var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
                var authentication = new UsernamePasswordAuthenticationToken(userId, email, authorities);
                authentication.setDetails(claims);

                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }

        filterChain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        var bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }

    private long parseEpochMillis(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ignored) {
            return Long.MAX_VALUE;
        }
    }

    private boolean isLegalConsentExempt(HttpServletRequest request) {
        String path = request.getServletPath();
        if (!StringUtils.hasText(path)) {
            path = request.getRequestURI();
            String contextPath = request.getContextPath();
            if (StringUtils.hasText(contextPath) && path.startsWith(contextPath)) {
                path = path.substring(contextPath.length());
            }
        }

        return path.equals("/auth/legal-consent")
                || path.equals("/auth/me")
                || path.equals("/auth/logout")
                || path.equals("/auth/account")
                || path.equals("/auth/login")
                || path.equals("/auth/register")
                || path.equals("/auth/refresh")
                || path.equals("/auth/send-code")
                || path.startsWith("/auth/password-reset/")
                || path.startsWith("/auth/wechat/challenges")
                || path.startsWith("/auth/wechat/reauth-challenges")
                || path.startsWith("/public/")
                || path.equals("/health")
                || path.equals("/ready")
                || path.startsWith("/v3/api-docs/")
                || path.startsWith("/swagger-ui/")
                || path.equals("/swagger-ui.html")
                || path.equals("/doc.html")
                || path.startsWith("/webjars/");
    }

    private void writeLegalConsentRequired(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(
                "{\"code\":" + ResultCode.LEGAL_CONSENT_REQUIRED.getCode()
                        + ",\"message\":\"" + ResultCode.LEGAL_CONSENT_REQUIRED.getMessage()
                        + "\",\"data\":null}"
        );
    }
}
