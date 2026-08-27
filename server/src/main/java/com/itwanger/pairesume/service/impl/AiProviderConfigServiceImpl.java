package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.AiProviderConfigUpdateDTO;
import com.itwanger.pairesume.dto.AiProviderConfigViewDTO;
import com.itwanger.pairesume.dto.AiProviderDisclosureDTO;
import com.itwanger.pairesume.dto.AiProviderTestResultDTO;
import com.itwanger.pairesume.entity.AiProviderConfig;
import com.itwanger.pairesume.entity.AiProviderConfigAudit;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.AiProviderConfigAuditMapper;
import com.itwanger.pairesume.mapper.AiProviderConfigMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.service.AiProviderConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

@Slf4j
@Service
public class AiProviderConfigServiceImpl implements AiProviderConfigService {
    private final AiProviderConfigMapper configMapper;
    private final AiProviderConfigAuditMapper auditMapper;
    private final AiProviderCryptoService cryptoService;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;
    private final WebClient webClient;

    @Value("${ai.api-key:}")
    private String envApiKey;

    @Value("${ai.base-url:}")
    private String envBaseUrl;

    @Value("${ai.model:}")
    private String envGeneralModel;

    @Value("${ai.analysis-model:${ai.model:}}")
    private String envAnalysisModel;

    @Value("${ai.provider.disclosure-name:${AI_PROVIDER_NAME:}}")
    private String envDisclosureName;

    @Value("${ai.provider.disclosure-url:${AI_PROVIDER_PRIVACY_URL:}}")
    private String envDisclosureUrl;

    private volatile ActiveAiConfig cachedActive;

    public AiProviderConfigServiceImpl(
            AiProviderConfigMapper configMapper,
            AiProviderConfigAuditMapper auditMapper,
            AiProviderCryptoService cryptoService,
            UserMapper userMapper,
            ObjectMapper objectMapper
    ) {
        this.configMapper = configMapper;
        this.auditMapper = auditMapper;
        this.cryptoService = cryptoService;
        this.userMapper = userMapper;
        this.objectMapper = objectMapper;
        this.webClient = WebClient.builder().build();
    }

    @Override
    @Transactional(readOnly = true)
    public AiProviderConfigViewDTO view() {
        return toView(requireRow());
    }

    @Override
    @Transactional
    public AiProviderConfigViewDTO update(Long adminUserId, AiProviderConfigUpdateDTO dto) {
        var config = requireRow();
        var preset = AiProviderPreset.require(dto.getProviderCode());
        String modelId = preset.requireModel(dto.getModelId());
        var changedFields = new ArrayList<String>();
        boolean keyRotated = false;
        boolean disclosureChanged = false;
        boolean providerChanged = !equalsNullable(config.getProviderCode(), preset.code());

        if (providerChanged && (dto.getApiKey() == null || dto.getApiKey().isBlank())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    "切换 AI 服务商时必须填写新的 API Key");
        }

        if (providerChanged) {
            config.setProviderCode(preset.code());
            changedFields.add("providerCode");
        }
        if (!equalsNullable(config.getDisplayName(), preset.displayName())) {
            config.setDisplayName(preset.displayName());
            changedFields.add("displayName");
            disclosureChanged = true;
        }
        if (!equalsNullable(config.getBaseUrl(), preset.baseUrl())) {
            config.setBaseUrl(preset.baseUrl());
            changedFields.add("baseUrl");
        }
        if (!equalsNullable(config.getGeneralModel(), modelId)) {
            config.setGeneralModel(modelId);
            changedFields.add("generalModel");
        }
        if (!equalsNullable(config.getAnalysisModel(), modelId)) {
            config.setAnalysisModel(modelId);
            changedFields.add("analysisModel");
        }
        if (!equalsNullable(config.getPrivacyPolicyUrl(), preset.privacyPolicyUrl())) {
            config.setPrivacyPolicyUrl(preset.privacyPolicyUrl());
            changedFields.add("privacyPolicyUrl");
            disclosureChanged = true;
        }
        boolean wasAutoUpgrade = Boolean.TRUE.equals(config.getAutoUpgrade());
        if (wasAutoUpgrade != dto.isAutoUpgrade()) {
            config.setAutoUpgrade(dto.isAutoUpgrade());
            changedFields.add("autoUpgrade");
        }
        boolean wasEnabled = Boolean.TRUE.equals(config.getEnabled());
        if (wasEnabled != dto.isEnabled()) {
            config.setEnabled(dto.isEnabled());
            changedFields.add("enabled");
        }

        if (dto.getApiKey() != null && !dto.getApiKey().isBlank()) {
            if (!cryptoService.isAvailable()) {
                throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(),
                        "未配置 AI_PROVIDER_MASTER_KEY，无法保存加密 API Key");
            }
            config.setApiKeyCipher(cryptoService.encrypt(dto.getApiKey().strip()));
            config.setApiKeyMask(AiProviderCryptoService.mask(dto.getApiKey()));
            changedFields.add("apiKey");
            keyRotated = true;
        }

        if (Boolean.TRUE.equals(dto.isEnabled()) && config.getApiKeyCipher() == null
                && (envApiKey == null || envApiKey.isBlank())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    "启用前必须配置 API Key");
        }

        config.setUpdatedBy(adminUserId);
        configMapper.updateById(config);

        if (disclosureChanged && Boolean.TRUE.equals(config.getEnabled())) {
            resetAiDisclosureForAllUsers();
        }

        auditMapper.insert(audit(adminUserId, "UPDATE",
                String.join(",", changedFields), keyRotated,
                "更新完成，变更字段 " + changedFields.size() + " 个"));

        cachedActive = null;
        return toView(config);
    }

    @Override
    public AiProviderTestResultDTO testConnection(Long adminUserId) {
        var active = resolveSavedConfigForTest();
        var preset = AiProviderPreset.require(active.providerCode());
        var result = new AiProviderTestResultDTO();
        result.setAvailableModels(preset.availableModels(List.of()));
        long start = System.currentTimeMillis();
        try {
            var modelIds = fetchAvailableModelIds(active);
            long latency = System.currentTimeMillis() - start;
            result.setSuccess(true);
            result.setLatencyMillis((int) latency);
            result.setMessage("连接成功，HTTP 200");
            result.setAvailableModels(preset.availableModels(modelIds));
        } catch (Exception e) {
            result.setSuccess(false);
            result.setLatencyMillis((int) (System.currentTimeMillis() - start));
            result.setMessage(e.getClass().getSimpleName());
            log.warn("[AI Provider] connection test failed: provider={}, errorType={}, latencyMs={}",
                    active.displayName(), e.getClass().getSimpleName(), result.getLatencyMillis());
        }

        auditMapper.insert(audit(adminUserId, "TEST", null, false,
                (result.isSuccess() ? "成功" : "失败") + "，耗时 " + result.getLatencyMillis() + "ms"));
        return result;
    }

    @Override
    public void refreshModelAutomatically() {
        var config = configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID);
        if (config == null || !Boolean.TRUE.equals(config.getEnabled())
                || !Boolean.TRUE.equals(config.getAutoUpgrade())) {
            return;
        }

        var active = resolveSavedConfig(config);
        var preset = AiProviderPreset.require(active.providerCode());
        var latest = preset.latestCompatibleModel(
                config.getGeneralModel(), fetchAvailableModelIds(active));
        if (latest.isEmpty()) {
            return;
        }

        String currentModel = config.getGeneralModel();
        String nextModel = latest.get();
        int updated = configMapper.update(null, new UpdateWrapper<AiProviderConfig>()
                .set("general_model", nextModel)
                .set("analysis_model", nextModel)
                .set("updated_by", 0L)
                .eq("id", AiProviderConfig.SINGLE_ROW_ID)
                .eq("provider_code", config.getProviderCode())
                .eq("general_model", currentModel)
                .eq("auto_upgrade", 1)
                .eq("enabled", 1));
        if (updated == 1) {
            auditMapper.insert(audit(0L, "AUTO_MODEL_UPGRADE",
                    "generalModel,analysisModel", false,
                    "同系列模型已从 " + currentModel + " 升级到 " + nextModel));
            cachedActive = null;
            log.info("[AI Provider] model auto-upgraded: provider={}, from={}, to={}",
                    config.getProviderCode(), currentModel, nextModel);
        }
    }

    private ActiveAiConfig resolveSavedConfigForTest() {
        return resolveSavedConfig(requireRow());
    }

    private ActiveAiConfig resolveSavedConfig(AiProviderConfig config) {
        String apiKey = config.getApiKeyCipher() == null
                ? envApiKey : cryptoService.decrypt(config.getApiKeyCipher());
        if (apiKey == null || apiKey.isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    "测试前必须配置 API Key");
        }
        return new ActiveAiConfig(
                config.getProviderCode(),
                config.getDisplayName(),
                config.getBaseUrl(),
                apiKey,
                config.getGeneralModel(),
                config.getAnalysisModel(),
                true
        );
    }

    private List<String> fetchAvailableModelIds(ActiveAiConfig active) {
        String body = webClient.get()
                .uri(URI.create(joinUrl(active.baseUrl(), "/models")))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + active.apiKey())
                .retrieve()
                .bodyToMono(String.class)
                .block(Duration.ofSeconds(10));
        if (body == null || body.isBlank()) {
            return List.of();
        }
        try {
            var root = objectMapper.readTree(body);
            var ids = new LinkedHashSet<String>();
            root.path("data").forEach(model -> {
                String id = model.path("id").asText("").strip();
                if (!id.isEmpty()) {
                    ids.add(id);
                }
            });
            return List.copyOf(ids);
        } catch (Exception e) {
            log.warn("[AI Provider] model list parse failed: provider={}, errorType={}",
                    active.providerCode(), e.getClass().getSimpleName());
            return List.of();
        }
    }

    @Override
    public ActiveAiConfig resolveActive() {
        var cached = cachedActive;
        if (cached != null) {
            return cached;
        }

        var config = configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID);
        if (config != null && Boolean.TRUE.equals(config.getEnabled()) && config.getApiKeyCipher() != null) {
            String apiKey = cryptoService.decrypt(config.getApiKeyCipher());
            var active = new ActiveAiConfig(
                    config.getProviderCode(),
                    config.getDisplayName(),
                    config.getBaseUrl(),
                    apiKey,
                    config.getGeneralModel(),
                    config.getAnalysisModel(),
                    true
            );
            cachedActive = active;
            return active;
        }
        if (config != null && Boolean.TRUE.equals(config.getEnabled())) {
            // 启用但密钥来自环境变量回退（例如历史环境 Key 仍在使用）。
            var active = new ActiveAiConfig(
                    config.getProviderCode(),
                    config.getDisplayName(),
                    config.getBaseUrl(),
                    envApiKey,
                    config.getGeneralModel(),
                    config.getAnalysisModel(),
                    true
            );
            cachedActive = active;
            return active;
        }

        var fallback = new ActiveAiConfig(
                AiProviderPreset.inferCode(envBaseUrl),
                "环境变量配置",
                envBaseUrl,
                envApiKey,
                envGeneralModel,
                envAnalysisModel,
                false
        );
        cachedActive = fallback;
        return fallback;
    }

    @Override
    public AiProviderDisclosureDTO disclosure() {
        var view = new AiProviderDisclosureDTO();
        var config = configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID);
        if (config != null && Boolean.TRUE.equals(config.getEnabled())) {
            view.setAiProviderName(config.getDisplayName());
            view.setAiProviderPrivacyUrl(config.getPrivacyPolicyUrl());
            return view;
        }
        view.setAiProviderName(envDisclosureName == null ? "" : envDisclosureName.strip());
        view.setAiProviderPrivacyUrl(envDisclosureUrl == null ? "" : envDisclosureUrl.strip());
        return view;
    }

    private void resetAiDisclosureForAllUsers() {
        int updated = userMapper.update(null, new UpdateWrapper<User>()
                .set("ai_processing_disclosure_version", null)
                .isNotNull("ai_processing_disclosure_version"));
        log.info("[AI Provider] provider disclosure changed, {} users need re-consent", updated);
    }

    private AiProviderConfig requireRow() {
        var config = configMapper.selectById(AiProviderConfig.SINGLE_ROW_ID);
        if (config == null) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(),
                    "AI 服务商配置行缺失");
        }
        return config;
    }

    private AiProviderConfigViewDTO toView(AiProviderConfig config) {
        var view = new AiProviderConfigViewDTO();
        view.setProviderCode(config.getProviderCode());
        view.setDisplayName(config.getDisplayName());
        view.setBaseUrl(config.getBaseUrl());
        view.setGeneralModel(config.getGeneralModel());
        view.setAnalysisModel(config.getAnalysisModel());
        view.setAvailableModels(AiProviderPreset.require(config.getProviderCode())
                .availableModels(List.of(config.getGeneralModel())));
        view.setApiKeyMask(config.getApiKeyMask());
        view.setApiKeyConfigured(config.getApiKeyCipher() != null);
        view.setPrivacyPolicyUrl(config.getPrivacyPolicyUrl());
        view.setAutoUpgrade(Boolean.TRUE.equals(config.getAutoUpgrade()));
        view.setEnabled(Boolean.TRUE.equals(config.getEnabled()));
        view.setMasterKeyConfigured(cryptoService.isAvailable());
        view.setUpdatedAt(config.getUpdatedAt());
        return view;
    }

    private AiProviderConfigAudit audit(
            Long adminUserId,
            String action,
            String changedFields,
            boolean apiKeyRotated,
            String detail
    ) {
        var record = new AiProviderConfigAudit();
        record.setAdminUserId(adminUserId);
        record.setAction(action);
        record.setChangedFields(changedFields);
        record.setApiKeyRotated(apiKeyRotated);
        record.setDetail(detail);
        return record;
    }

    private String joinUrl(String baseUrl, String path) {
        String normalized = baseUrl == null ? "" : baseUrl.strip();
        if (normalized.endsWith(path)) {
            return normalized;
        }
        return normalized.replaceAll("/+$", "") + path;
    }

    private boolean equalsNullable(String a, String b) {
        return a == null ? b == null : a.equals(b);
    }
}
