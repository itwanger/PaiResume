package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.WechatPayConfigUpdateDTO;
import com.itwanger.pairesume.dto.WechatPayConfigViewDTO;
import com.itwanger.pairesume.service.WechatPayConfigService;
import com.itwanger.pairesume.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "管理后台微信支付配置")
@RestController
@RequestMapping("/admin/wechat-pay")
@RequiredArgsConstructor
public class AdminWechatPayConfigController {
    private final WechatPayConfigService service;

    @Operation(summary = "查看微信支付配置（不返回明文或密文）")
    @GetMapping
    public Result<WechatPayConfigViewDTO> view() {
        return Result.success(service.view());
    }

    @Operation(summary = "更新微信支付配置，两个凭据留空表示保留原值或从环境变量导入")
    @PutMapping
    public Result<WechatPayConfigViewDTO> update(@Valid @RequestBody WechatPayConfigUpdateDTO request) {
        return Result.success(service.update(SecurityUtils.getCurrentUserId(), request));
    }
}
