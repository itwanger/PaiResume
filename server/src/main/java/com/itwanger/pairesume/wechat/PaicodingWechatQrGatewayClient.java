package com.itwanger.pairesume.wechat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.config.WechatQrAuthProperties;
import com.itwanger.pairesume.payment.QrCodeDataUrlGenerator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

@Slf4j
@Component
public class PaicodingWechatQrGatewayClient implements WechatQrGatewayClient {

    private static final int MAX_RESPONSE_BYTES = 2_000_000;

    private final WechatQrAuthProperties properties;
    private final WechatBridgeSigner signer;
    private final ObjectMapper objectMapper;
    private final QrCodeDataUrlGenerator qrCodeGenerator;
    private final HttpClient httpClient;
    private final SecureRandom secureRandom = new SecureRandom();

    @Autowired
    public PaicodingWechatQrGatewayClient(
            WechatQrAuthProperties properties,
            WechatBridgeSigner signer,
            ObjectMapper objectMapper,
            QrCodeDataUrlGenerator qrCodeGenerator
    ) {
        this(properties, signer, objectMapper, qrCodeGenerator,
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
    }

    PaicodingWechatQrGatewayClient(
            WechatQrAuthProperties properties,
            WechatBridgeSigner signer,
            ObjectMapper objectMapper,
            QrCodeDataUrlGenerator qrCodeGenerator,
            HttpClient httpClient
    ) {
        this.properties = properties;
        this.signer = signer;
        this.objectMapper = objectMapper;
        this.qrCodeGenerator = qrCodeGenerator;
        this.httpClient = httpClient;
    }

    @Override
    public String createTemporaryQr(String scene, int expireSeconds) {
        properties.requireReady();
        try {
            byte[] rawBody = objectMapper.writeValueAsBytes(Map.of(
                    "scene", scene,
                    "expireSeconds", expireSeconds
            ));
            String timestamp = String.valueOf(Instant.now().getEpochSecond());
            byte[] nonceBytes = new byte[18];
            secureRandom.nextBytes(nonceBytes);
            String nonce = Base64.getUrlEncoder().withoutPadding().encodeToString(nonceBytes);
            String signature = signer.sign(properties.getBridgeSecret(), timestamp, nonce, rawBody);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(properties.normalizedGatewayBaseUrl() + properties.getGatewayQrPath()))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .header("X-Pai-Timestamp", timestamp)
                    .header("X-Pai-Nonce", nonce)
                    .header("X-Pai-Signature", signature)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(rawBody))
                    .build();
            HttpResponse<InputStream> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofInputStream()
            );
            byte[] responseBody;
            try (InputStream input = response.body()) {
                responseBody = input.readNBytes(MAX_RESPONSE_BYTES + 1);
            }
            if (response.statusCode() / 100 != 2 || responseBody.length > MAX_RESPONSE_BYTES) {
                throw new IllegalStateException("Paicoding QR gateway rejected the request");
            }
            JsonNode root = objectMapper.readTree(responseBody);
            // paicoding 的统一响应字段名是 result；同时兼容 PaiResume 风格的 data，
            // 便于本地 mock/后续网关迁移，但绝不能在缺少二维码载荷时静默成功。
            JsonNode data = root.has("result") && root.get("result").isObject()
                    ? root.get("result")
                    : root.has("data") && root.get("data").isObject() ? root.get("data") : root;
            String image = text(data, "qrImageDataUrl");
            if (StringUtils.hasText(image)) {
                validateQrDataUrl(image);
                return image;
            }
            String content = text(data, "qrContent");
            if (!StringUtils.hasText(content)) {
                throw new IllegalStateException("Paicoding QR gateway returned no QR payload");
            }
            return qrCodeGenerator.generate(content);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Paicoding QR gateway request was interrupted", exception);
        } catch (Exception exception) {
            log.warn("Paicoding QR gateway request failed: errorType={}", exception.getClass().getSimpleName());
            throw exception instanceof IllegalStateException state
                    ? state : new IllegalStateException("Paicoding QR gateway request failed", exception);
        }
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || !value.isTextual() ? null : value.asText();
    }

    private void validateQrDataUrl(String value) {
        String prefix = "data:image/png;base64,";
        if (!value.startsWith(prefix) || value.length() > MAX_RESPONSE_BYTES) {
            throw new IllegalStateException("Paicoding QR gateway returned an unsafe image payload");
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(value.substring(prefix.length()));
            if (decoded.length < 8
                    || decoded[0] != (byte) 0x89 || decoded[1] != 0x50
                    || decoded[2] != 0x4e || decoded[3] != 0x47) {
                throw new IllegalStateException("Paicoding QR gateway returned an invalid PNG");
            }
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("Paicoding QR gateway returned invalid base64", exception);
        }
    }
}
