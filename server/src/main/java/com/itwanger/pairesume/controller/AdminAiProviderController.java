package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.AiProviderConfigUpdateDTO;
import com.itwanger.pairesume.dto.AiProviderConfigViewDTO;
import com.itwanger.pairesume.dto.AiProviderTestResultDTO;
import com.itwanger.pairesume.service.AiProviderConfigService;
import com.itwanger.pairesume.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "管理后台 AI 服务商配置")
@RestController
@RequestMapping("/admin/ai-provider")
@RequiredArgsConstructor
public class AdminAiProviderController {
    private final AiProviderConfigService service;

    @Operation(summary = "查看 AI 服务商配置（仅掩码，不返回明文或密文）")
    @GetMapping
    public Result<AiProviderConfigViewDTO> view() {
        return Result.success(service.view());
    }

    @Operation(summary = "更新 AI 服务商配置，API Key 留空表示保留原值")
    @PutMapping
    public Result<AiProviderConfigViewDTO> update(@Valid @RequestBody AiProviderConfigUpdateDTO request) {
        return Result.success(service.update(SecurityUtils.getCurrentUserId(), request));
    }

    @Operation(summary = "测试当前生效配置的连通性")
    @PostMapping("/test")
    public Result<AiProviderTestResultDTO> testConnection() {
        return Result.success(service.testConnection(SecurityUtils.getCurrentUserId()));
    }
}
