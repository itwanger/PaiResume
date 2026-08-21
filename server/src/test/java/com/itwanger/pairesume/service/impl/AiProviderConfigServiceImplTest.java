package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.dto.AiProviderConfigUpdateDTO;
import com.itwanger.pairesume.entity.AiProviderConfig;
import com.itwanger.pairesume.entity.AiProviderConfigAudit;
import com.itwanger.pairesume.mapper.AiProviderConfigAuditMapper;
import com.itwanger.pairesume.mapper.AiProviderConfigMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.service.AiProviderConfigService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiProviderConfigServiceImplTest {
    private static final long ADMIN_ID = 20L;

    @Mock
    private AiProviderConfigMapper configMapper;

    @Mock
    private AiProviderConfigAuditMapper auditMapper;

    @Mock
    private UserMapper userMapper;

    private AiProviderCryptoService cryptoService;
    private AiProviderConfigServiceImpl service;

    @BeforeEach
    void setUp() {
        cryptoService = new AiProviderCryptoService(Base64.getEncoder()
                .encodeToString(new byte[32]));
        service = new AiProviderConfigServiceImpl(configMapper, auditMapper, cryptoService, userMapper);
        ReflectionTestUtils.setField(service, "envApiKey", "env-key");
        ReflectionTestUtils.setField(service, "envBaseUrl", "http://env-url/v1");
        ReflectionTestUtils.setField(service, "envGeneralModel", "env-general");
        ReflectionTestUtils.setField(service, "envAnalysisModel", "env-analysis");
    }

    @AfterEach
    void tearDown() {
        ReflectionTestUtils.setField(service, "cachedActive", null);
    }

    @Test
    void viewReturnsMaskOnlyAndNeverSecrets() {
        var config = storedConfig();
        config.setApiKeyCipher(cryptoService.encrypt("sk-live-abcdefgh1234"));
        config.setApiKeyMask(AiProviderCryptoService.mask("sk-live-abcdefgh1234"));
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(config);

        var view = service.view();

        assertEquals("sk-l••••1234", view.getApiKeyMask());
        assertTrue(view.isApiKeyConfigured());
        assertTrue(view.isMasterKeyConfigured());
        assertFalse(view.isEnabled());
        assertNull(view.getUpdatedAt());
    }

    @Test
    void blankApiKeyKeepsExistingCipherAndMask() {
        var config = storedConfig();
        byte[] originalCipher = cryptoService.encrypt("sk-live-original-key");
        config.setApiKeyCipher(originalCipher);
        config.setApiKeyMask("sk-l••••-key");
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(config);

        var result = service.update(ADMIN_ID, update("DeepSeek", "https://api.deepseek.com/v1",
                "deepseek-chat", "deepseek-chat", "", "", false));

        assertArrayEquals(originalCipher, config.getApiKeyCipher());
        assertEquals("sk-l••••-key", config.getApiKeyMask());
        assertFalse(result.isApiKeyConfigured() && result.getApiKeyMask().isEmpty());

        var audit = captureAudit();
        assertEquals("UPDATE", audit.getAction());
        assertFalse(audit.getApiKeyRotated());
        assertFalse(audit.getChangedFields().contains("apiKey"));
    }

    @Test
    void nonBlankApiKeyRotatesCipherAndMask() {
        var config = storedConfig();
        config.setApiKeyCipher(cryptoService.encrypt("sk-live-old-value"));
        config.setApiKeyMask("sk-l••••alue");
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(config);

        service.update(ADMIN_ID, update("DeepSeek", "https://api.deepseek.com/v1",
                "deepseek-chat", "deepseek-chat", "sk-live-new-value", "", false));

        assertEquals(AiProviderCryptoService.mask("sk-live-new-value"), config.getApiKeyMask());
        assertEquals("sk-live-new-value", cryptoService.decrypt(config.getApiKeyCipher()));

        var audit = captureAudit();
        assertTrue(audit.getApiKeyRotated());
        assertTrue(audit.getChangedFields().contains("apiKey"));
    }

    @Test
    void enablingWithoutAnyKeyIsRejected() {
        ReflectionTestUtils.setField(service, "envApiKey", "");
        var config = storedConfig();
        config.setApiKeyCipher(null);
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(config);

        var error = assertThrows(BusinessException.class, () -> service.update(ADMIN_ID,
                update("DeepSeek", "https://api.deepseek.com/v1",
                        "deepseek-chat", "deepseek-chat", "", "", true)));

        assertEquals("启用前必须配置 API Key", error.getMessage());
        verify(configMapper, never()).updateById(any(AiProviderConfig.class));
    }

    @Test
    void savingEncryptedKeyWithoutMasterKeyFailsClosed() {
        var noKeyCrypto = new AiProviderCryptoService("");
        var closed = new AiProviderConfigServiceImpl(
                configMapper, auditMapper, noKeyCrypto, userMapper);
        ReflectionTestUtils.setField(closed, "envApiKey", "env-key");
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(storedConfig());

        var error = assertThrows(BusinessException.class, () -> closed.update(ADMIN_ID,
                update("DeepSeek", "https://api.deepseek.com/v1",
                        "deepseek-chat", "deepseek-chat", "sk-live-value", "", true)));

        assertEquals(500, error.getCode());
        assertTrue(error.getMessage().contains("AI_PROVIDER_MASTER_KEY"));
    }

    @Test
    void providerDisclosureChangeWhileEnabledResetsUserConsent() {
        var config = storedConfig();
        config.setEnabled(true);
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(config);

        service.update(ADMIN_ID, update("智谱 AI", "https://api.deepseek.com/v1",
                "deepseek-chat", "deepseek-chat", "", "", true));

        verify(userMapper).update(isNull(), any());
    }

    @Test
    void providerChangeWhileDisabledDoesNotResetConsent() {
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(storedConfig());

        service.update(ADMIN_ID, update("智谱 AI", "https://api.deepseek.com/v1",
                "deepseek-chat", "deepseek-chat", "", "", false));

        verify(userMapper, never()).update(any(), any());
    }

    @Test
    void resolveActivePrefersEnabledDatabaseConfigAndCaches() {
        var config = storedConfig();
        config.setEnabled(true);
        config.setApiKeyCipher(cryptoService.encrypt("sk-live-db-key"));
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(config);

        var first = service.resolveActive();
        var second = service.resolveActive();

        assertTrue(first.fromDatabase());
        assertEquals("sk-live-db-key", first.apiKey());
        assertEquals(first, second);
        verify(configMapper, times(1)).selectById(any());
    }

    @Test
    void resolveActiveFallsBackToEnvironmentWhenDisabled() {
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(storedConfig());

        var active = service.resolveActive();

        assertFalse(active.fromDatabase());
        assertEquals("env-key", active.apiKey());
        assertEquals("http://env-url/v1", active.baseUrl());
        assertEquals("env-general", active.generalModel());
        assertEquals("env-analysis", active.analysisModel());
    }

    @Test
    void updateInvalidatesActiveConfigCache() {
        var config = storedConfig();
        config.setEnabled(true);
        config.setApiKeyCipher(cryptoService.encrypt("sk-live-db-key"));
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(config);

        var before = service.resolveActive();
        assertEquals("sk-live-db-key", before.apiKey());

        service.update(ADMIN_ID, update("DeepSeek", "https://api.deepseek.com/v1",
                "deepseek-chat", "deepseek-chat", "sk-live-rotated-key", "", true));
        var after = service.resolveActive();

        assertEquals("sk-live-rotated-key", after.apiKey());
        verify(configMapper, times(3)).selectById(any());
    }

    @Test
    void testConnectionRecordsAuditWithoutSecrets() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        server.setExecutor(executor);
        server.createContext("/v1/models", exchange -> {
            byte[] body = "{\"data\":[]}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            var config = storedConfig();
            config.setEnabled(true);
            config.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/v1");
            config.setApiKeyCipher(cryptoService.encrypt("sk-live-db-key"));
            when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(config);

            var result = service.testConnection(ADMIN_ID);

            assertTrue(result.isSuccess());
            assertTrue(result.getLatencyMillis() >= 0);
            var audit = captureAudit();
            assertEquals("TEST", audit.getAction());
            assertFalse(audit.getDetail().contains("sk-live"));
        } finally {
            server.stop(0);
            executor.shutdownNow();
        }
    }

    @Test
    void disclosurePrefersEnabledDatabaseConfig() {
        ReflectionTestUtils.setField(service, "envDisclosureName", "智谱 AI");
        ReflectionTestUtils.setField(service, "envDisclosureUrl", "https://env.example.com/privacy");
        var config = storedConfig();
        config.setEnabled(true);
        config.setDisplayName("DeepSeek");
        config.setPrivacyPolicyUrl("https://db.example.com/privacy");
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(config);

        var disclosure = service.disclosure();

        assertEquals("DeepSeek", disclosure.getAiProviderName());
        assertEquals("https://db.example.com/privacy", disclosure.getAiProviderPrivacyUrl());
    }

    @Test
    void disclosureFallsBackToEnvironmentWhenDisabled() {
        ReflectionTestUtils.setField(service, "envDisclosureName", " 智谱 AI ");
        ReflectionTestUtils.setField(service, "envDisclosureUrl", " https://env.example.com/privacy ");
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(storedConfig());

        var disclosure = service.disclosure();

        assertEquals("智谱 AI", disclosure.getAiProviderName());
        assertEquals("https://env.example.com/privacy", disclosure.getAiProviderPrivacyUrl());
    }

    @Test
    void nonHttpsPrivacyUrlIsRejected() {
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(storedConfig());

        var error = assertThrows(BusinessException.class, () -> service.update(ADMIN_ID,
                update("DeepSeek", "https://api.deepseek.com/v1",
                        "deepseek-chat", "deepseek-chat", "", "http://insecure.example.com", false)));

        assertEquals("隐私政策链接必须是合法的 HTTPS 地址", error.getMessage());
        verify(configMapper, never()).updateById(any(AiProviderConfig.class));
    }

    private AiProviderConfig storedConfig() {
        var config = new AiProviderConfig();
        config.setId(AiProviderConfig.SINGLE_ROW_ID);
        config.setDisplayName("DeepSeek");
        config.setBaseUrl("https://api.deepseek.com/v1");
        config.setGeneralModel("deepseek-chat");
        config.setAnalysisModel("deepseek-chat");
        config.setPrivacyPolicyUrl("");
        config.setEnabled(false);
        return config;
    }

    private AiProviderConfigUpdateDTO update(
            String displayName, String baseUrl, String generalModel,
            String analysisModel, String apiKey, String privacyUrl, boolean enabled
    ) {
        var dto = new AiProviderConfigUpdateDTO();
        dto.setDisplayName(displayName);
        dto.setBaseUrl(baseUrl);
        dto.setGeneralModel(generalModel);
        dto.setAnalysisModel(analysisModel);
        dto.setApiKey(apiKey);
        dto.setPrivacyPolicyUrl(privacyUrl);
        dto.setEnabled(enabled);
        return dto;
    }

    private AiProviderConfigAudit captureAudit() {
        var captor = ArgumentCaptor.forClass(AiProviderConfigAudit.class);
        verify(auditMapper).insert(captor.capture());
        return captor.getValue();
    }
}
