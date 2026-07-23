package com.itwanger.pairesume.wechat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.config.WechatQrAuthProperties;
import com.itwanger.pairesume.payment.QrCodeDataUrlGenerator;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PaicodingWechatQrGatewayClientTest {

    @Test
    void gatewayRequestSignsExactRawBodyAndCanRenderReturnedQrContent() throws Exception {
        AtomicReference<byte[]> receivedBody = new AtomicReference<>();
        AtomicReference<String> timestamp = new AtomicReference<>();
        AtomicReference<String> nonce = new AtomicReference<>();
        AtomicReference<String> signature = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/internal/pairesume/wechat/qrcodes", exchange -> {
            receivedBody.set(exchange.getRequestBody().readAllBytes());
            timestamp.set(exchange.getRequestHeaders().getFirst("X-Pai-Timestamp"));
            nonce.set(exchange.getRequestHeaders().getFirst("X-Pai-Nonce"));
            signature.set(exchange.getRequestHeaders().getFirst("X-Pai-Signature"));
            // paicoding ResVo 的真实载荷字段是 result，不是 PaiResume 的 data。
            byte[] response = "{\"status\":{\"code\":0},\"result\":{\"qrContent\":\"http://weixin.qq.com/q/demo\"}}"
                    .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
        try {
            WechatQrAuthProperties properties = new WechatQrAuthProperties();
            properties.setEnabled(true);
            properties.setGatewayBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
            properties.setBridgeSecret("bridge-secret-that-is-at-least-32-characters");
            properties.setAccountAppId("wx1234567890abcdef");
            WechatBridgeSigner signer = new WechatBridgeSigner();
            var client = new PaicodingWechatQrGatewayClient(
                    properties, signer, new ObjectMapper(), new QrCodeDataUrlGenerator()
            );

            String image = client.createTemporaryQr("pr_L_" + "A".repeat(43), 300);

            assertTrue(image.startsWith("data:image/png;base64,"));
            assertTrue(nonce.get().matches("[A-Za-z0-9_-]{24}"));
            assertEquals(
                    signer.sign(properties.getBridgeSecret(), timestamp.get(), nonce.get(), receivedBody.get()),
                    signature.get()
            );
            var requestJson = new ObjectMapper().readTree(receivedBody.get());
            assertEquals("pr_L_" + "A".repeat(43), requestJson.get("scene").asText());
            assertEquals(300, requestJson.get("expireSeconds").asInt());
        } finally {
            server.stop(0);
        }
    }
}
