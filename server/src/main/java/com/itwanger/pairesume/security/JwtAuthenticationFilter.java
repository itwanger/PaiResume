package com.itwanger.pairesume.security;

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

    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider, StringRedisTemplate redisTemplate) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.redisTemplate = redisTemplate;
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

            if (!isBlacklisted && !isSessionRevoked) {
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
}
