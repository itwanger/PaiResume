package com.itwanger.pairesume.wechat;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WechatBridgeSignerTest {

    private final WechatBridgeSigner signer = new WechatBridgeSigner();

    @Test
    void signatureCoversTimestampNonceAndExactRawBody() {
        String secret = "bridge-secret-that-is-at-least-32-characters";
        byte[] body = "{\"scene\":\"pr_L_demo\"}".getBytes(StandardCharsets.UTF_8);
        String signature = signer.sign(secret, "1770000000", "nonce_0123456789", body);

        assertEquals(64, signature.length());
        assertTrue(signer.matches(signature, signature));
        assertFalse(signer.matches(
                signer.sign(secret, "1770000000", "nonce_0123456789", " {}".getBytes(StandardCharsets.UTF_8)),
                signature
        ));
        assertFalse(signer.matches(signature, "not-a-signature"));
    }
}
