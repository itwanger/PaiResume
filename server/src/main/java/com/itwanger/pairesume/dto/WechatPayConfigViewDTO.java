package com.itwanger.pairesume.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class WechatPayConfigViewDTO {
    private String appId;
    private String merchantId;
    private String privateKeyMask;
    private String merchantSerialNumber;
    private String apiV3KeyMask;
    private String paymentNotifyUrl;
    private String refundNotifyUrl;
    private boolean storedCredentialsConfigured;
    private boolean environmentFallbackConfigured;
    private boolean masterKeyConfigured;
    private boolean enabled;
    private LocalDateTime updatedAt;
}
