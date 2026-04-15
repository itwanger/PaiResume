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
import lombok.Data;
import org.springframework.web.bind.annotation.*;

@Tag(name = "认证接口")
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @Operation(summary = "用户注册")
    @PostMapping("/register")
    public Result<TokenDTO> register(@Valid @RequestBody RegisterDTO dto) {
        return Result.success(authService.register(dto));
    }

    @Operation(summary = "用户登录")
    @PostMapping("/login")
    public Result<TokenDTO> login(@Valid @RequestBody LoginDTO dto) {
        return Result.success(authService.login(dto));
    }

    @Operation(summary = "获取当前用户信息")
    @GetMapping("/me")
    public Result<UserInfoDTO> me() {
        return Result.success(authService.getCurrentUserInfo(SecurityUtils.getCurrentUserId()));
    }

    @Operation(summary = "刷新 Token")
    @PostMapping("/refresh")
    public Result<TokenDTO> refresh(@RequestBody RefreshRequest request) {
        return Result.success(authService.refreshToken(request.getRefreshToken()));
    }

    @Operation(summary = "用户登出")
    @PostMapping("/logout")
    public Result<Void> logout(@RequestHeader("Authorization") String authHeader) {
        var token = authHeader.substring(7);
        var userId = SecurityUtils.getCurrentUserId();
        authService.logout(userId, token);
        return Result.success();
    }

    @Operation(summary = "发送邮箱验证码")
    @PostMapping("/send-code")
    public Result<Void> sendCode(@Valid @RequestBody SendCodeRequest request) {
        authService.sendVerificationCode(request.getEmail());
        return Result.success();
    }

    @Data
    public static class RefreshRequest {
        @NotBlank
        private String refreshToken;
    }

    @Data
    public static class SendCodeRequest {
        @NotBlank @Email
        private String email;
    }
}
