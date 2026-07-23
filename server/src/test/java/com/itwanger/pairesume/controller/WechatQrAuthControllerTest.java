package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.dto.TokenDTO;
import com.itwanger.pairesume.dto.UserInfoDTO;
import com.itwanger.pairesume.service.WechatQrAuthService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WechatQrAuthControllerTest {

    @Mock private WechatQrAuthService wechatQrAuthService;

    @Test
    void loginExchangeKeepsRefreshTokenOutOfJsonAndInHardenedCookiePipeline() {
        var controller = new WechatQrAuthController(
                wechatQrAuthService, "pai_refresh", true, 604800L
        );
        var user = new UserInfoDTO(
                7L, null, "微信用户", "", "USER", "FREE", null, null,
                false, true, false, false, true, true
        );
        when(wechatQrAuthService.exchangeLoginChallenge("challenge", "poll-token"))
                .thenReturn(new TokenDTO("access", "refresh", 900L, user));
        var response = new MockHttpServletResponse();

        controller.exchangeLoginChallenge("challenge", "poll-token", response);

        String cookie = response.getHeader(HttpHeaders.SET_COOKIE);
        assertNotNull(cookie);
        assertTrue(cookie.contains("pai_refresh=refresh"));
        assertTrue(cookie.contains("Path=/api/auth"));
        assertTrue(cookie.contains("Secure"));
        assertTrue(cookie.contains("HttpOnly"));
        assertTrue(cookie.contains("SameSite=Strict"));
    }
}
