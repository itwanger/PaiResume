package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AiProviderCryptoServiceTest {

    private static String masterKey() {
        return Base64.getEncoder().encodeToString(new byte[32]);
    }

    @Test
    void encryptDecryptRoundTripPreservesApiKey() {
        var service = new AiProviderCryptoService(masterKey());
        byte[] cipher = service.encrypt("sk-live-abcdefgh1234");
        assertEquals("sk-live-abcdefgh1234", service.decrypt(cipher));
        assertFalse(new String(cipher).contains("sk-live"));
    }

    @Test
    void eachEncryptionUsesFreshIv() {
        var service = new AiProviderCryptoService(masterKey());
        assertFalse(java.util.Arrays.equals(
                service.encrypt("same-key"), service.encrypt("same-key")));
    }

    @Test
    void operationsWithoutMasterKeyFailClosed() {
        var service = new AiProviderCryptoService("");
        assertFalse(service.isAvailable());
        assertEquals(500, assertThrows(BusinessException.class,
                () -> service.encrypt("sk-live-value")).getCode());
        assertEquals(500, assertThrows(BusinessException.class,
                () -> service.decrypt(new byte[20])).getCode());
    }

    @Test
    void tamperedCipherFailsAuthentication() {
        var service = new AiProviderCryptoService(masterKey());
        byte[] cipher = service.encrypt("sk-live-abcdefgh1234");
        cipher[cipher.length - 1] ^= 0x01;
        assertThrows(BusinessException.class, () -> service.decrypt(cipher));
    }

    @Test
    void maskNeverExposesMiddleOfKey() {
        assertEquals("sk-l••••1234", AiProviderCryptoService.mask("sk-live-abcdefgh1234"));
        assertEquals("••••（4 字符）", AiProviderCryptoService.mask("abcd"));
        assertEquals("", AiProviderCryptoService.mask(""));
        assertEquals("", AiProviderCryptoService.mask(null));
    }

    @Test
    void invalidMasterKeyFormatRejectedAtStartup() {
        assertThrows(IllegalStateException.class,
                () -> new AiProviderCryptoService("not-base64!!!"));
        assertThrows(IllegalStateException.class,
                () -> new AiProviderCryptoService(Base64.getEncoder().encodeToString(new byte[16])));
    }
}
