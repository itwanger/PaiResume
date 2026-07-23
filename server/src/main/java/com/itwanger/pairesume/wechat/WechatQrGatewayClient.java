package com.itwanger.pairesume.wechat;

public interface WechatQrGatewayClient {
    String createTemporaryQr(String scene, int expireSeconds);
}
