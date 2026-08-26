package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.*;
import com.itwanger.pairesume.service.AuthService;
import com.itwanger.pairesume.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.Data;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.*;

@Tag(name = "认证接口")
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;
    private final String refreshCookieName;
    private final boolean refreshCookieSecure;
    private final long refreshCookieMaxAgeSeconds;

    public AuthController(
            AuthService authService,
            @Value("${app.auth.refresh-cookie-name:pai_refresh}") String refreshCookieName,
            @Value("${app.auth.refresh-cookie-secure:false}") boolean refreshCookieSecure,
            @Value("${app.auth.refresh-cookie-max-age-seconds:604800}") long refreshCookieMaxAgeSeconds
    ) {
        this.authService = authService;
        this.refreshCookieName = refreshCookieName;
        this.refreshCookieSecure = refreshCookieSecure;
        this.refreshCookieMaxAgeSeconds = refreshCookieMaxAgeSeconds;
    }

    @Operation(summary = "用户注册")
    @PostMapping("/register")
    public Result<TokenDTO> register(@Valid @RequestBody RegisterDTO dto,
                                     HttpServletRequest request,
                                     HttpServletResponse response) {
        return tokenResponse(authService.register(dto, request.getRemoteAddr()), response);
    }

    @Operation(summary = "用户登录")
    @PostMapping("/login")
    public Result<TokenDTO> login(@Valid @RequestBody LoginDTO dto,
                                  HttpServletRequest request,
                                  HttpServletResponse response) {
        return tokenResponse(authService.login(dto, request.getRemoteAddr()), response);
    }

    @Operation(summary = "获取当前用户信息")
    @GetMapping("/me")
    public Result<UserInfoDTO> me() {
        return Result.success(authService.getCurrentUserInfo(SecurityUtils.getCurrentUserId()));
    }

    @Operation(summary = "更新当前用户资料")
    @PutMapping("/profile")
    public Result<UserInfoDTO> updateProfile(@Valid @RequestBody AccountProfileUpdateDTO dto) {
        return Result.success(authService.updateProfile(SecurityUtils.getCurrentUserId(), dto));
    }

    @Operation(summary = "刷新 Token")
    @PostMapping("/refresh")
    public Result<TokenDTO> refresh(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = readRefreshCookie(request);
        if (refreshToken == null) {
            throw new com.itwanger.pairesume.common.BusinessException(
                    com.itwanger.pairesume.common.ResultCode.REFRESH_TOKEN_INVALID
            );
        }
        return tokenResponse(authService.refreshToken(refreshToken), response);
    }

    @Operation(summary = "用户登出")
    @PostMapping("/logout")
    public Result<Void> logout(@RequestHeader("Authorization") String authHeader,
                               HttpServletResponse response) {
        var token = authHeader.substring(7);
        var userId = SecurityUtils.getCurrentUserId();
        authService.logout(userId, token);
        response.addHeader(HttpHeaders.SET_COOKIE, buildRefreshCookie("", 0));
        return Result.success();
    }

    @Operation(summary = "发送邮箱验证码")
    @PostMapping("/send-code")
    public Result<Void> sendCode(@Valid @RequestBody SendCodeRequest request,
                                 HttpServletRequest servletRequest) {
        authService.sendVerificationCode(request.getEmail(), servletRequest.getRemoteAddr());
        return Result.success();
    }

    @Operation(summary = "发送重置密码验证码")
    @PostMapping("/password-reset/code")
    public Result<Void> requestPasswordReset(@Valid @RequestBody PasswordResetRequestDTO dto,
                                             HttpServletRequest request) {
        authService.requestPasswordReset(dto.getEmail(), request.getRemoteAddr());
        return Result.success();
    }

    @Operation(summary = "确认重置密码")
    @PostMapping("/password-reset/confirm")
    public Result<Void> resetPassword(@Valid @RequestBody PasswordResetConfirmDTO dto) {
        authService.resetPassword(dto);
        return Result.success();
    }

    @Operation(summary = "发送绑定邮箱验证码")
    @PostMapping("/email-binding/code")
    public Result<Void> requestEmailBinding(@Valid @RequestBody EmailBindingCodeDTO dto,
                                            HttpServletRequest request) {
        authService.requestEmailBinding(SecurityUtils.getCurrentUserId(), dto, request.getRemoteAddr());
        return Result.success();
    }

    @Operation(summary = "绑定邮箱并启用邮箱密码登录")
    @PostMapping("/email-binding/confirm")
    public Result<UserInfoDTO> bindEmail(@Valid @RequestBody EmailBindingConfirmDTO dto) {
        return Result.success(authService.bindEmail(SecurityUtils.getCurrentUserId(), dto));
    }

    @Operation(summary = "同意当前版本服务条款与隐私政策")
    @PostMapping("/legal-consent")
    public Result<UserInfoDTO> acceptLegalConsent(@Valid @RequestBody LegalConsentDTO dto) {
        return Result.success(authService.acceptLegalConsent(SecurityUtils.getCurrentUserId(), dto));
    }

    @Operation(summary = "注销当前账号")
    @DeleteMapping("/account")
    public Result<Void> deleteAccount(@Valid @RequestBody AccountDeletionDTO dto,
                                      HttpServletResponse response) {
        authService.deleteAccount(SecurityUtils.getCurrentUserId(), dto);
        response.addHeader(HttpHeaders.SET_COOKIE, buildRefreshCookie("", 0));
        return Result.success();
    }

    @Data
    public static class SendCodeRequest {
        @NotBlank @Email
        @jakarta.validation.constraints.Size(max = 128)
        private String email;
    }

    private Result<TokenDTO> tokenResponse(TokenDTO token, HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, buildRefreshCookie(token.getRefreshToken(), refreshCookieMaxAgeSeconds));
        return Result.success(token);
    }

    private String readRefreshCookie(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        for (var cookie : request.getCookies()) {
            if (refreshCookieName.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private String buildRefreshCookie(String value, long maxAgeSeconds) {
        return ResponseCookie.from(refreshCookieName, value)
                .httpOnly(true)
                .secure(refreshCookieSecure)
                .sameSite("Strict")
                .path("/api/auth")
                .maxAge(maxAgeSeconds)
                .build()
                .toString();
    }
}
