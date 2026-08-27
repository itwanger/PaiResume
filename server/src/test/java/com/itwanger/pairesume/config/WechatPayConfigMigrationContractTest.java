package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WechatPayConfigMigrationContractTest {
    @Test
    void v42EncryptsSecretsAndKeepsPaymentAndRefundCallbacksSeparate() throws Exception {
        var resource = new ClassPathResource("db/migration/V42__create_wechat_pay_config.sql");
        String sql;
        try (var input = resource.getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertTrue(sql.contains("`private_key_cipher` MEDIUMBLOB"));
        assertTrue(sql.contains("`api_v3_key_cipher` BLOB"));
        assertTrue(sql.contains("`payment_notify_url` VARCHAR(255)"));
        assertTrue(sql.contains("`refund_notify_url` VARCHAR(255)"));
        assertTrue(sql.contains("/api/public/payments/wechat/notify"));
        assertTrue(sql.contains("/api/public/payments/wechat/refund-notify"));
        assertFalse(sql.contains("`private_key` VARCHAR"));
        assertFalse(sql.contains("`api_v3_key` VARCHAR"));
    }
}
