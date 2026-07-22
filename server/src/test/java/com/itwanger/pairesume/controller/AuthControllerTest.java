package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.dto.LoginDTO;
import com.itwanger.pairesume.dto.RegisterDTO;
import com.itwanger.pairesume.dto.TokenDTO;
import com.itwanger.pairesume.dto.UserInfoDTO;
import com.itwanger.pairesume.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import jakarta.servlet.http.Cookie;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private AuthService authService;
    private AuthController controller;
    private TokenDTO token;

    @BeforeEach
    void setUp() {
        controller = new AuthController(authService, "pai_refresh", true, 604800L);
        var user = new UserInfoDTO(1L, "user@example.com", "", "", "USER", "FREE", null, null, false);
        token = new TokenDTO("access-token", "refresh-token", 900L, user);
    }

    @Test
    void loginPlacesRefreshTokenOnlyInAHardenedCookie() {
        when(authService.login(any(LoginDTO.class), eq("127.0.0.1"))).thenReturn(token);
        var request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        var response = new MockHttpServletResponse();

        controller.login(new LoginDTO(), request, response);

        String setCookie = response.getHeader(HttpHeaders.SET_COOKIE);
        assertNotNull(setCookie);
        assertTrue(setCookie.contains("pai_refresh=refresh-token"));
        assertTrue(setCookie.contains("Path=/api/auth"));
        assertTrue(setCookie.contains("Secure"));
        assertTrue(setCookie.contains("HttpOnly"));
        assertTrue(setCookie.contains("SameSite=Strict"));
    }

    @Test
    void registerForwardsClientIpForInviteRateLimiting() {
        RegisterDTO dto = new RegisterDTO();
        when(authService.register(dto, "203.0.113.8")).thenReturn(token);
        var request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.8");
        var response = new MockHttpServletResponse();

        controller.register(dto, request, response);

        verify(authService).register(dto, "203.0.113.8");
        assertNotNull(response.getHeader(HttpHeaders.SET_COOKIE));
    }

    @Test
    void refreshReadsRotatingTokenFromCookieRatherThanRequestBody() {
        when(authService.refreshToken("old-refresh-token")).thenReturn(token);
        var request = new MockHttpServletRequest();
        request.setCookies(new Cookie("pai_refresh", "old-refresh-token"));
        var response = new MockHttpServletResponse();

        controller.refresh(request, response);

        verify(authService).refreshToken("old-refresh-token");
        assertNotNull(response.getHeader(HttpHeaders.SET_COOKIE));
    }
}
