package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.TokenDTO;
import com.itwanger.pairesume.dto.UserInfoDTO;
import com.itwanger.pairesume.dto.WechatChallengeCreateDTO;
import com.itwanger.pairesume.dto.LegalConsentDTO;
import com.itwanger.pairesume.dto.WechatChallengeRequestDTO;
import com.itwanger.pairesume.dto.WechatChallengeStatusDTO;
import com.itwanger.pairesume.dto.WechatReauthProofDTO;
import com.itwanger.pairesume.service.WechatQrAuthService;
import com.itwanger.pairesume.util.SecurityUtils;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth/wechat")
public class WechatQrAuthController {

    private final WechatQrAuthService wechatQrAuthService;
    private final String refreshCookieName;
    private final boolean refreshCookieSecure;
    private final long refreshCookieMaxAgeSeconds;

    public WechatQrAuthController(
            WechatQrAuthService wechatQrAuthService,
            @Value("${app.auth.refresh-cookie-name:pai_refresh}") String refreshCookieName,
            @Value("${app.auth.refresh-cookie-secure:false}") boolean refreshCookieSecure,
            @Value("${app.auth.refresh-cookie-max-age-seconds:604800}") long refreshCookieMaxAgeSeconds
    ) {
        this.wechatQrAuthService = wechatQrAuthService;
        this.refreshCookieName = refreshCookieName;
        this.refreshCookieSecure = refreshCookieSecure;
        this.refreshCookieMaxAgeSeconds = refreshCookieMaxAgeSeconds;
    }

    @PostMapping("/challenges")
    public Result<WechatChallengeCreateDTO> createLoginChallenge(
            @Valid @RequestBody(required = false) WechatChallengeRequestDTO dto,
            HttpServletRequest request
    ) {
        return Result.success(wechatQrAuthService.createLoginChallenge(
                request.getRemoteAddr(), dto == null ? null : dto.getClaimToken()
        ));
    }

    @GetMapping("/challenges/{challengeId}")
    public Result<WechatChallengeStatusDTO> pollLoginChallenge(
            @PathVariable String challengeId,
            @RequestHeader(WechatQrAuthService.POLL_TOKEN_HEADER) String pollToken
    ) {
        return Result.success(wechatQrAuthService.pollLoginChallenge(challengeId, pollToken));
    }

    @PostMapping("/challenges/{challengeId}/exchange")
    public Result<TokenDTO> exchangeLoginChallenge(
            @PathVariable String challengeId,
            @RequestHeader(WechatQrAuthService.POLL_TOKEN_HEADER) String pollToken,
            @Valid @RequestBody(required = false) LegalConsentDTO dto,
            HttpServletResponse response
    ) {
        TokenDTO token = wechatQrAuthService.exchangeLoginChallenge(challengeId, pollToken, dto);
        response.addHeader(HttpHeaders.SET_COOKIE, buildRefreshCookie(token.getRefreshToken()));
        return Result.success(token);
    }

    @PostMapping("/bind-challenges")
    public Result<WechatChallengeCreateDTO> createBindChallenge(HttpServletRequest request) {
        return Result.success(
                wechatQrAuthService.createBindChallenge(
                        SecurityUtils.getCurrentUserId(), request.getRemoteAddr()
                )
        );
    }

    @GetMapping("/bind-challenges/{challengeId}")
    public Result<WechatChallengeStatusDTO> pollBindChallenge(
            @PathVariable String challengeId,
            @RequestHeader(WechatQrAuthService.POLL_TOKEN_HEADER) String pollToken
    ) {
        return Result.success(wechatQrAuthService.pollBindChallenge(
                SecurityUtils.getCurrentUserId(), challengeId, pollToken
        ));
    }

    @PostMapping("/bind-challenges/{challengeId}/exchange")
    public Result<UserInfoDTO> exchangeBindChallenge(
            @PathVariable String challengeId,
            @RequestHeader(WechatQrAuthService.POLL_TOKEN_HEADER) String pollToken
    ) {
        return Result.success(wechatQrAuthService.exchangeBindChallenge(
                SecurityUtils.getCurrentUserId(), challengeId, pollToken
        ));
    }

    @PostMapping("/reauth-challenges")
    public Result<WechatChallengeCreateDTO> createReauthChallenge(HttpServletRequest request) {
        return Result.success(wechatQrAuthService.createReauthChallenge(
                SecurityUtils.getCurrentUserId(), request.getRemoteAddr()
        ));
    }

    @GetMapping("/reauth-challenges/{challengeId}")
    public Result<WechatChallengeStatusDTO> pollReauthChallenge(
            @PathVariable String challengeId,
            @RequestHeader(WechatQrAuthService.POLL_TOKEN_HEADER) String pollToken
    ) {
        return Result.success(wechatQrAuthService.pollReauthChallenge(
                SecurityUtils.getCurrentUserId(), challengeId, pollToken
        ));
    }

    @PostMapping("/reauth-challenges/{challengeId}/exchange")
    public Result<WechatReauthProofDTO> exchangeReauthChallenge(
            @PathVariable String challengeId,
            @RequestHeader(WechatQrAuthService.POLL_TOKEN_HEADER) String pollToken
    ) {
        return Result.success(wechatQrAuthService.exchangeReauthChallenge(
                SecurityUtils.getCurrentUserId(), challengeId, pollToken
        ));
    }

    private String buildRefreshCookie(String value) {
        return ResponseCookie.from(refreshCookieName, value)
                .httpOnly(true)
                .secure(refreshCookieSecure)
                .sameSite("Strict")
                .path("/api/auth")
                .maxAge(refreshCookieMaxAgeSeconds)
                .build()
                .toString();
    }
}
