package com.itwanger.pairesume.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.util.regex.Pattern;

@Data
@Component
@ConfigurationProperties(prefix = "app.auth.wechat-service")
public class WechatQrAuthProperties {

    private static final Pattern SCENE_PREFIX = Pattern.compile("[A-Za-z0-9_-]{2,16}");

    private boolean enabled;
    private String gatewayBaseUrl;
    private String gatewayQrPath = "/api/internal/pairesume/wechat/qrcodes";
    private String bridgeSecret;
    private String accountAppId;
    private String scenePrefix = "pr_";
    private int challengeTtlSeconds = 300;
    private int bridgeClockSkewSeconds = 300;
    private int bridgeReplayTtlSeconds = 600;
    private int challengeCreateMinuteLimit = 10;

    /**
     * Runtime guard used by both inbound and outbound paths. Keeping the feature disabled is valid;
     * once enabled, partial configuration must never degrade to an unsigned or local-only flow.
     */
    public void requireReady() {
        if (!enabled) {
            throw new IllegalStateException("Paicongming QR login is disabled");
        }
        if (!StringUtils.hasText(gatewayBaseUrl)
                || !StringUtils.hasText(gatewayQrPath)
                || !gatewayQrPath.startsWith("/")
                || gatewayQrPath.startsWith("//")
                || gatewayQrPath.contains("?")
                || gatewayQrPath.contains("#")
                || !StringUtils.hasText(accountAppId)
                || !StringUtils.hasText(bridgeSecret)
                || bridgeSecret.length() < 32
                || !SCENE_PREFIX.matcher(scenePrefix == null ? "" : scenePrefix).matches()
                || challengeTtlSeconds < 60 || challengeTtlSeconds > 600
                || challengeCreateMinuteLimit < 1 || challengeCreateMinuteLimit > 60
                || bridgeClockSkewSeconds < 30 || bridgeClockSkewSeconds > 600
                || bridgeReplayTtlSeconds < bridgeClockSkewSeconds) {
            throw new IllegalStateException("Paicongming QR login configuration is incomplete or unsafe");
        }
        URI gateway = URI.create(gatewayBaseUrl.trim());
        if (!StringUtils.hasText(gateway.getScheme()) || !StringUtils.hasText(gateway.getHost())
                || gateway.getUserInfo() != null || gateway.getQuery() != null || gateway.getFragment() != null) {
            throw new IllegalStateException("Paicongming QR gateway URL is invalid");
        }
    }

    public String normalizedGatewayBaseUrl() {
        String value = gatewayBaseUrl == null ? "" : gatewayBaseUrl.trim();
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
