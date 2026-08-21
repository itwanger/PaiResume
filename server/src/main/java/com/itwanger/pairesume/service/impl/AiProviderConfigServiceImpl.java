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
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class AiProviderConfigServiceImpl implements AiProviderConfigService {
    private final AiProviderConfigMapper configMapper;
    private final AiProviderConfigAuditMapper auditMapper;
    private final AiProviderCryptoService cryptoService;
    private final UserMapper userMapper;
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
            UserMapper userMapper
    ) {
        this.configMapper = configMapper;
        this.auditMapper = auditMapper;
        this.cryptoService = cryptoService;
        this.userMapper = userMapper;
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
        var changedFields = new ArrayList<String>();
        boolean keyRotated = false;
        boolean disclosureChanged = false;

        if (!equalsNullable(config.getDisplayName(), dto.getDisplayName())) {
            config.setDisplayName(dto.getDisplayName());
            changedFields.add("displayName");
            disclosureChanged = true;
        }
        if (!equalsNullable(config.getBaseUrl(), dto.getBaseUrl())) {
            config.setBaseUrl(dto.getBaseUrl());
            changedFields.add("baseUrl");
        }
        if (!equalsNullable(config.getGeneralModel(), dto.getGeneralModel())) {
            config.setGeneralModel(dto.getGeneralModel());
            changedFields.add("generalModel");
        }
        if (!equalsNullable(config.getAnalysisModel(), dto.getAnalysisModel())) {
            config.setAnalysisModel(dto.getAnalysisModel());
            changedFields.add("analysisModel");
        }
        String normalizedPrivacyUrl = dto.getPrivacyPolicyUrl() == null
                ? "" : dto.getPrivacyPolicyUrl().strip();
        if (!normalizedPrivacyUrl.isEmpty() && !isHttpsUrl(normalizedPrivacyUrl)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    "隐私政策链接必须是合法的 HTTPS 地址");
        }
        if (!equalsNullable(config.getPrivacyPolicyUrl(), normalizedPrivacyUrl)) {
            config.setPrivacyPolicyUrl(normalizedPrivacyUrl);
            changedFields.add("privacyPolicyUrl");
            disclosureChanged = true;
        }
        boolean wasEnabled = Boolean.TRUE.equals(config.getEnabled());
        if (wasEnabled != dto.isEnabled()) {
            config.setEnabled(dto.isEnabled());
            changedFields.add("enabled");
        }

        if (dto.getApiKey() != null && !dto.getApiKey().isBlank()) {
            if (Boolean.TRUE.equals(dto.isEnabled()) && !cryptoService.isAvailable()) {
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
        var active = resolveActive();
        var result = new AiProviderTestResultDTO();
        long start = System.currentTimeMillis();
        try {
            var response = webClient.get()
                    .uri(URI.create(joinUrl(active.baseUrl(), "/models")))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + active.apiKey())
                    .retrieve()
                    .toBodilessEntity()
                    .block(Duration.ofSeconds(10));
            long latency = System.currentTimeMillis() - start;
            result.setSuccess(response != null && response.getStatusCode().is2xxSuccessful());
            result.setLatencyMillis((int) latency);
            result.setMessage(result.isSuccess()
                    ? "连接成功，HTTP " + (response != null ? response.getStatusCode().value() : 200)
                    : "服务返回非 2xx 状态");
        } catch (Exception e) {
            result.setSuccess(false);
            result.setLatencyMillis((int) (System.currentTimeMillis() - start));
            result.setMessage("连接失败：" + e.getClass().getSimpleName());
            log.warn("[AI Provider] connection test failed: provider={}, errorType={}, latencyMs={}",
                    active.displayName(), e.getClass().getSimpleName(), result.getLatencyMillis());
        }

        auditMapper.insert(audit(adminUserId, "TEST", null, false,
                (result.isSuccess() ? "成功" : "失败") + "，耗时 " + result.getLatencyMillis() + "ms"));
        return result;
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
        view.setDisplayName(config.getDisplayName());
        view.setBaseUrl(config.getBaseUrl());
        view.setGeneralModel(config.getGeneralModel());
        view.setAnalysisModel(config.getAnalysisModel());
        view.setApiKeyMask(config.getApiKeyMask());
        view.setApiKeyConfigured(config.getApiKeyCipher() != null);
        view.setPrivacyPolicyUrl(config.getPrivacyPolicyUrl());
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

    private boolean isHttpsUrl(String value) {
        try {
            var uri = java.net.URI.create(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && uri.getHost() != null
                    && uri.getUserInfo() == null;
        } catch (RuntimeException e) {
            return false;
        }
    }

    private boolean equalsNullable(String a, String b) {
        return a == null ? b == null : a.equals(b);
    }
}
