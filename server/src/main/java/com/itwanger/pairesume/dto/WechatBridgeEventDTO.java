package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class WechatBridgeEventDTO {
    @NotBlank
    @Size(max = 64)
    private String appId;

    @NotBlank
    @Pattern(regexp = "(?i)^(subscribe|scan|unsubscribe)$")
    private String eventType;

    @NotBlank
    @Pattern(regexp = "^[A-Za-z0-9_-]{6,128}$")
    private String openId;

    @Size(max = 64)
    private String scene;
}
