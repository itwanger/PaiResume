package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.dto.AiProviderConfigUpdateDTO;
import com.itwanger.pairesume.entity.AiProviderConfig;
import com.itwanger.pairesume.entity.AiProviderConfigAudit;
import com.itwanger.pairesume.mapper.AiProviderConfigAuditMapper;
import com.itwanger.pairesume.mapper.AiProviderConfigMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.service.AiProviderConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
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
        service = new AiProviderConfigServiceImpl(
                configMapper, auditMapper, cryptoService, userMapper, new ObjectMapper());
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

        var result = service.update(ADMIN_ID, update("DEEPSEEK", "", false));

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

        service.update(ADMIN_ID, update("DEEPSEEK", "sk-live-new-value", false));

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
                update("DEEPSEEK", "", true)));

        assertEquals("启用前必须配置 API Key", error.getMessage());
        verify(configMapper, never()).updateById(any(AiProviderConfig.class));
    }

    @Test
    void savingEncryptedKeyWithoutMasterKeyFailsClosedEvenWhenDisabled() {
        var noKeyCrypto = new AiProviderCryptoService("");
        var closed = new AiProviderConfigServiceImpl(
                configMapper, auditMapper, noKeyCrypto, userMapper, new ObjectMapper());
        ReflectionTestUtils.setField(closed, "envApiKey", "env-key");
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(storedConfig());

        var error = assertThrows(BusinessException.class, () -> closed.update(ADMIN_ID,
                update("DEEPSEEK", "sk-live-value", false)));

        assertEquals(500, error.getCode());
        assertTrue(error.getMessage().contains("AI_PROVIDER_MASTER_KEY"));
    }

    @Test
    void providerDisclosureChangeWhileEnabledResetsUserConsent() {
        var config = storedConfig();
        config.setEnabled(true);
        config.setDisplayName("历史服务商名称");
        config.setPrivacyPolicyUrl("https://example.com/legacy-privacy");
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(config);

        service.update(ADMIN_ID, update("DEEPSEEK", "", true));

        verify(userMapper).update(isNull(), any());
    }

    @Test
    void providerChangeWhileDisabledDoesNotResetConsent() {
        var config = storedConfig();
        config.setDisplayName("历史服务商名称");
        config.setPrivacyPolicyUrl("https://example.com/legacy-privacy");
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(config);

        service.update(ADMIN_ID, update("DEEPSEEK", "", false));

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

        service.update(ADMIN_ID, update("DEEPSEEK", "sk-live-rotated-key", true));
        var after = service.resolveActive();

        assertEquals("sk-live-rotated-key", after.apiKey());
        verify(configMapper, times(3)).selectById(any());
    }

    @Test
    void testConnectionUsesSavedDisabledConfigAndRecordsAuditWithoutSecrets() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        server.setExecutor(executor);
        server.createContext("/v1/models", exchange -> {
            byte[] body = """
                    {"data":[
                      {"id":"deepseek-v4-flash"},
                      {"id":"deepseek-v5-flash"},
                      {"id":"unrelated-model"}
                    ]}
                    """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            var config = storedConfig();
            config.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/v1");
            config.setApiKeyCipher(cryptoService.encrypt("sk-live-db-key"));
            when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(config);

            var result = service.testConnection(ADMIN_ID);

            assertTrue(result.isSuccess());
            assertTrue(result.getLatencyMillis() >= 0);
            assertTrue(result.getAvailableModels().stream()
                    .anyMatch(model -> "deepseek-v5-flash".equals(model.id())));
            var audit = captureAudit();
            assertEquals("TEST", audit.getAction());
            assertFalse(audit.getDetail().contains("sk-live"));
        } finally {
            server.stop(0);
            executor.shutdownNow();
        }
    }

    @Test
    void automaticRefreshUpgradesOnlyWithinSelectedFamily() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        server.setExecutor(executor);
        server.createContext("/models", exchange -> {
            byte[] body = """
                    {"data":[
                      {"id":"deepseek-v5-flash"},
                      {"id":"deepseek-v6-pro"},
                      {"id":"deepseek-v7-flash-vision-exp"}
                    ]}
                    """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            var config = storedConfig();
            config.setEnabled(true);
            config.setAutoUpgrade(true);
            config.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
            config.setApiKeyCipher(cryptoService.encrypt("sk-live-db-key"));
            when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(config);
            when(configMapper.update(isNull(), any(UpdateWrapper.class))).thenReturn(1);

            service.refreshModelAutomatically();

            var audit = captureAudit();
            assertEquals("AUTO_MODEL_UPGRADE", audit.getAction());
            assertTrue(audit.getDetail().contains("deepseek-v4-flash"));
            assertTrue(audit.getDetail().contains("deepseek-v5-flash"));
            assertFalse(audit.getDetail().contains("deepseek-v6-pro"));
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
    void unsupportedProviderIsRejected() {
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(storedConfig());

        var error = assertThrows(BusinessException.class, () -> service.update(ADMIN_ID,
                update("UNKNOWN", "", false)));

        assertEquals("不支持的 AI 服务商", error.getMessage());
        verify(configMapper, never()).updateById(any(AiProviderConfig.class));
    }

    @Test
    void providerPresetOverridesStoredConnectionParameters() {
        var config = storedConfig();
        config.setBaseUrl("https://example.com/custom");
        config.setGeneralModel("custom-general");
        config.setAnalysisModel("custom-analysis");
        config.setPrivacyPolicyUrl("https://example.com/privacy");
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(config);

        var result = service.update(ADMIN_ID, update("deepseek", "", false));

        assertEquals("DEEPSEEK", result.getProviderCode());
        assertEquals("DeepSeek", result.getDisplayName());
        assertEquals("https://api.deepseek.com", result.getBaseUrl());
        assertEquals("deepseek-v4-flash", result.getGeneralModel());
        assertEquals("deepseek-v4-flash", result.getAnalysisModel());
        assertEquals("https://cdn.deepseek.com/policies/zh-CN/deepseek-privacy-policy.html",
                result.getPrivacyPolicyUrl());
    }

    @Test
    void deepSeekModelCanBeSelected() {
        var config = storedConfig();
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(config);

        var result = service.update(ADMIN_ID,
                update("DEEPSEEK", "deepseek-v4-pro", "", false, false));

        assertEquals("deepseek-v4-pro", result.getGeneralModel());
        assertEquals("deepseek-v4-pro", result.getAnalysisModel());
    }

    @Test
    void switchingToGlmRequiresNewKeyAndAppliesPreset() {
        var config = storedConfig();
        config.setApiKeyCipher(cryptoService.encrypt("sk-deepseek-old"));
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(config);

        var missingKey = assertThrows(BusinessException.class, () -> service.update(ADMIN_ID,
                update("GLM", "glm-5.3-flash", "", false, false)));
        assertEquals("切换 AI 服务商时必须填写新的 API Key", missingKey.getMessage());

        var result = service.update(ADMIN_ID,
                update("GLM", "glm-5.3-flash", "glm-new-key", true, false));
        assertEquals("GLM", result.getProviderCode());
        assertEquals("智谱 GLM", result.getDisplayName());
        assertEquals("https://open.bigmodel.cn/api/paas/v4", result.getBaseUrl());
        assertEquals("glm-5.3-flash", result.getGeneralModel());
        assertTrue(result.isAutoUpgrade());
        assertEquals("glm-new-key", cryptoService.decrypt(config.getApiKeyCipher()));
    }

    @Test
    void modelOutsideProviderFamilyIsRejected() {
        when(configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID)).thenReturn(storedConfig());

        var error = assertThrows(BusinessException.class, () -> service.update(ADMIN_ID,
                update("DEEPSEEK", "glm-5.3-flash", "", false, false)));

        assertEquals("当前服务商不支持该模型", error.getMessage());
        verify(configMapper, never()).updateById(any(AiProviderConfig.class));
    }

    private AiProviderConfig storedConfig() {
        var config = new AiProviderConfig();
        config.setId(AiProviderConfig.SINGLE_ROW_ID);
        config.setProviderCode("DEEPSEEK");
        config.setDisplayName("DeepSeek");
        config.setBaseUrl("https://api.deepseek.com");
        config.setGeneralModel("deepseek-v4-flash");
        config.setAnalysisModel("deepseek-v4-flash");
        config.setPrivacyPolicyUrl(
                "https://cdn.deepseek.com/policies/zh-CN/deepseek-privacy-policy.html");
        config.setAutoUpgrade(false);
        config.setEnabled(false);
        return config;
    }

    private AiProviderConfigUpdateDTO update(String providerCode, String apiKey, boolean enabled) {
        String modelId = "GLM".equalsIgnoreCase(providerCode)
                ? "glm-5.3-flash" : "deepseek-v4-flash";
        return update(providerCode, modelId, apiKey, false, enabled);
    }

    private AiProviderConfigUpdateDTO update(
            String providerCode,
            String modelId,
            String apiKey,
            boolean autoUpgrade,
            boolean enabled
    ) {
        var dto = new AiProviderConfigUpdateDTO();
        dto.setProviderCode(providerCode);
        dto.setModelId(modelId);
        dto.setApiKey(apiKey);
        dto.setAutoUpgrade(autoUpgrade);
        dto.setEnabled(enabled);
        return dto;
    }

    private AiProviderConfigAudit captureAudit() {
        var captor = ArgumentCaptor.forClass(AiProviderConfigAudit.class);
        verify(auditMapper).insert(captor.capture());
        return captor.getValue();
    }
}
