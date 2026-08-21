package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AI 服务商 API Key 的 AES-256-GCM 加解密。主密钥只允许来自权限 0600 的
 * 环境文件（AI_PROVIDER_MASTER_KEY，Base64 编码的 32 字节），任何情况下
 * 都不落库、不打日志。
 */
@Service
public class AiProviderCryptoService {
    private static final int GCM_IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";

    private final SecretKey masterKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public AiProviderCryptoService(
            @Value("${ai.provider.master-key:}") String masterKeyBase64
    ) {
        this.masterKey = parseMasterKey(masterKeyBase64);
    }

    public boolean isAvailable() {
        return masterKey != null;
    }

    public byte[] encrypt(String plaintext) {
        requireMasterKey();
        try {
            byte[] iv = new byte[GCM_IV_BYTES];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, masterKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] payload = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, payload, 0, iv.length);
            System.arraycopy(encrypted, 0, payload, iv.length, encrypted.length);
            return payload;
        } catch (Exception e) {
            throw new BusinessException(
                    ResultCode.INTERNAL_ERROR.getCode(), "AI 服务商密钥加密失败");
        }
    }

    public String decrypt(byte[] payload) {
        requireMasterKey();
        if (payload == null || payload.length <= GCM_IV_BYTES) {
            throw new BusinessException(
                    ResultCode.INTERNAL_ERROR.getCode(), "AI 服务商密钥密文无效");
        }
        try {
            GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_BITS, payload, 0, GCM_IV_BYTES);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, masterKey, spec);
            byte[] decrypted = cipher.doFinal(payload, GCM_IV_BYTES, payload.length - GCM_IV_BYTES);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new BusinessException(
                    ResultCode.INTERNAL_ERROR.getCode(), "AI 服务商密钥解密失败");
        }
    }

    public static String mask(String apiKey) {
        if (apiKey == null || apiKey.isEmpty()) {
            return "";
        }
        String trimmed = apiKey.strip();
        if (trimmed.length() <= 8) {
            return "••••（" + trimmed.length() + " 字符）";
        }
        return trimmed.substring(0, 4) + "••••" + trimmed.substring(trimmed.length() - 4);
    }

    private SecretKey parseMasterKey(String masterKeyBase64) {
        if (masterKeyBase64 == null || masterKeyBase64.isBlank()) {
            return null;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(masterKeyBase64.strip());
            if (decoded.length != 32) {
                throw new IllegalArgumentException("bad length");
            }
            return new SecretKeySpec(decoded, "AES");
        } catch (Exception e) {
            throw new IllegalStateException("AI_PROVIDER_MASTER_KEY 必须是 Base64 编码的 32 字节密钥");
        }
    }

    private void requireMasterKey() {
        if (masterKey == null) {
            throw new BusinessException(
                    ResultCode.INTERNAL_ERROR.getCode(),
                    "未配置 AI_PROVIDER_MASTER_KEY，无法处理已加密的 API Key");
        }
    }
}
