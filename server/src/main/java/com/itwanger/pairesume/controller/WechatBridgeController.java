package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.service.WechatQrAuthService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/public/wechat/bridge")
public class WechatBridgeController {

    private final WechatQrAuthService wechatQrAuthService;

    public WechatBridgeController(WechatQrAuthService wechatQrAuthService) {
        this.wechatQrAuthService = wechatQrAuthService;
    }

    @PostMapping(path = "/events", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Result<Void> event(
            @RequestHeader("X-Pai-Timestamp") String timestamp,
            @RequestHeader("X-Pai-Nonce") String nonce,
            @RequestHeader("X-Pai-Signature") String signature,
            @RequestBody byte[] rawBody
    ) {
        wechatQrAuthService.handleBridgeEvent(timestamp, nonce, signature, rawBody);
        return Result.success();
    }
}
