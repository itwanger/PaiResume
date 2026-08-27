package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.AiProviderModelOptionDTO;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/** 服务商固定地址、隐私披露和可用模型范围。 */
enum AiProviderPreset {
    DEEPSEEK(
            "DEEPSEEK",
            "DeepSeek",
            "https://api.deepseek.com",
            "https://cdn.deepseek.com/policies/zh-CN/deepseek-privacy-policy.html",
            "deepseek-v4-flash",
            Pattern.compile("^deepseek-v(\\d+(?:\\.\\d+)*)-(flash(?:-vision-exp)?|pro)$"),
            List.of(
                    new AiProviderModelOptionDTO("deepseek-v4-flash", "DeepSeek V4-Flash"),
                    new AiProviderModelOptionDTO("deepseek-v4-pro", "DeepSeek V4-Pro"),
                    new AiProviderModelOptionDTO(
                            "deepseek-v4-flash-vision-exp", "DeepSeek V4-Flash-Vision-Exp")
            )
    ),
    GLM(
            "GLM",
            "智谱 GLM",
            "https://open.bigmodel.cn/api/paas/v4",
            "https://docs.bigmodel.cn/cn/terms/privacy-policy",
            "glm-5.3-flash",
            Pattern.compile("^glm-(\\d+(?:\\.\\d+)*)-(flash)$"),
            List.of(new AiProviderModelOptionDTO("glm-5.3-flash", "GLM-5.3-Flash"))
    );

    private final String code;
    private final String displayName;
    private final String baseUrl;
    private final String privacyPolicyUrl;
    private final String defaultModelId;
    private final Pattern modelPattern;
    private final List<AiProviderModelOptionDTO> knownModels;

    AiProviderPreset(
            String code,
            String displayName,
            String baseUrl,
            String privacyPolicyUrl,
            String defaultModelId,
            Pattern modelPattern,
            List<AiProviderModelOptionDTO> knownModels
    ) {
        this.code = code;
        this.displayName = displayName;
        this.baseUrl = baseUrl;
        this.privacyPolicyUrl = privacyPolicyUrl;
        this.defaultModelId = defaultModelId;
        this.modelPattern = modelPattern;
        this.knownModels = knownModels;
    }

    static AiProviderPreset require(String code) {
        String normalized = code == null ? "" : code.strip();
        return Arrays.stream(values())
                .filter(provider -> provider.code.equalsIgnoreCase(normalized))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        ResultCode.BAD_REQUEST.getCode(), "不支持的 AI 服务商"));
    }

    static String inferCode(String baseUrl) {
        String normalized = baseUrl == null ? "" : baseUrl.toLowerCase(Locale.ROOT);
        return normalized.contains("open.bigmodel.cn") ? GLM.code : DEEPSEEK.code;
    }

    String requireModel(String modelId) {
        String normalized = modelId == null ? "" : modelId.strip().toLowerCase(Locale.ROOT);
        if (!supportsModel(normalized)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    "当前服务商不支持该模型");
        }
        return normalized;
    }

    boolean supportsModel(String modelId) {
        return modelId != null && modelPattern.matcher(modelId).matches();
    }

    List<AiProviderModelOptionDTO> availableModels(Collection<String> discoveredModelIds) {
        var models = new LinkedHashMap<String, String>();
        knownModels.forEach(model -> models.put(model.id(), model.label()));
        if (discoveredModelIds != null) {
            discoveredModelIds.stream()
                    .map(modelId -> modelId == null
                            ? "" : modelId.strip().toLowerCase(Locale.ROOT))
                    .filter(this::supportsModel)
                    .forEach(modelId -> models.putIfAbsent(modelId, modelLabel(modelId)));
        }
        return models.entrySet().stream()
                .map(entry -> new AiProviderModelOptionDTO(entry.getKey(), entry.getValue()))
                .toList();
    }

    Optional<String> latestCompatibleModel(String currentModel, Collection<String> discoveredModelIds) {
        var current = parseModel(currentModel);
        if (current.isEmpty() || discoveredModelIds == null) {
            return Optional.empty();
        }
        ParsedModel selected = current.get();
        var candidates = new ArrayList<ParsedModel>();
        for (String modelId : discoveredModelIds) {
            parseModel(modelId)
                    .filter(candidate -> candidate.family().equals(selected.family()))
                    .ifPresent(candidates::add);
        }
        return candidates.stream()
                .filter(candidate -> compareVersions(candidate.version(), selected.version()) > 0)
                .max((left, right) -> compareVersions(left.version(), right.version()))
                .map(ParsedModel::id);
    }

    private Optional<ParsedModel> parseModel(String modelId) {
        String normalized = modelId == null ? "" : modelId.strip().toLowerCase(Locale.ROOT);
        var matcher = modelPattern.matcher(normalized);
        if (!matcher.matches()) {
            return Optional.empty();
        }
        return Optional.of(new ParsedModel(normalized, matcher.group(1), matcher.group(2)));
    }

    private int compareVersions(String left, String right) {
        String[] leftParts = left.split("\\.");
        String[] rightParts = right.split("\\.");
        int max = Math.max(leftParts.length, rightParts.length);
        for (int i = 0; i < max; i++) {
            int leftPart = i < leftParts.length ? Integer.parseInt(leftParts[i]) : 0;
            int rightPart = i < rightParts.length ? Integer.parseInt(rightParts[i]) : 0;
            int compared = Integer.compare(leftPart, rightPart);
            if (compared != 0) {
                return compared;
            }
        }
        return 0;
    }

    private String modelLabel(String modelId) {
        var parsed = parseModel(modelId).orElseThrow();
        String family = Arrays.stream(parsed.family().split("-"))
                .map(part -> part.substring(0, 1).toUpperCase(Locale.ROOT) + part.substring(1))
                .reduce((left, right) -> left + "-" + right)
                .orElse("");
        return this == DEEPSEEK
                ? "DeepSeek V" + parsed.version() + "-" + family
                : "GLM-" + parsed.version() + "-" + family;
    }

    String code() {
        return code;
    }

    String displayName() {
        return displayName;
    }

    String baseUrl() {
        return baseUrl;
    }

    String privacyPolicyUrl() {
        return privacyPolicyUrl;
    }

    String defaultModelId() {
        return defaultModelId;
    }

    private record ParsedModel(String id, String version, String family) {
    }
}
