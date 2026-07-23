package com.itwanger.pairesume.wechat;

import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

@Component
public class WechatBridgeSigner {

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    public String sign(String secret, String timestamp, String nonce, byte[] rawBody) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            mac.update(timestamp.getBytes(StandardCharsets.UTF_8));
            mac.update((byte) '\n');
            mac.update(nonce.getBytes(StandardCharsets.UTF_8));
            mac.update((byte) '\n');
            return HexFormat.of().formatHex(mac.doFinal(rawBody));
        } catch (Exception exception) {
            throw new IllegalStateException("HMAC-SHA256 is not available", exception);
        }
    }

    public boolean matches(String expectedHex, String providedHex) {
        if (expectedHex == null || providedHex == null
                || !providedHex.matches("(?i)[0-9a-f]{64}")) {
            return false;
        }
        return MessageDigest.isEqual(
                expectedHex.getBytes(StandardCharsets.US_ASCII),
                providedHex.toLowerCase().getBytes(StandardCharsets.US_ASCII)
        );
    }

    public String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
