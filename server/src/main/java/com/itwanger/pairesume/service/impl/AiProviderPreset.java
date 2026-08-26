package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;

import java.util.Arrays;

/**
 * 管理后台可选的 AI 服务商预设。
 *
 * <p>地址、模型和隐私政策属于服务端受控配置，管理员只选择服务商并填写密钥，
 * 避免将任意上游地址或模型写入生产配置。</p>
 */
enum AiProviderPreset {
    DEEPSEEK(
            "DEEPSEEK",
            "DeepSeek",
            "https://api.deepseek.com",
            "deepseek-v4-flash",
            "deepseek-v4-flash",
            "https://cdn.deepseek.com/policies/zh-CN/deepseek-privacy-policy.html"
    );

    private final String code;
    private final String displayName;
    private final String baseUrl;
    private final String generalModel;
    private final String analysisModel;
    private final String privacyPolicyUrl;

    AiProviderPreset(
            String code,
            String displayName,
            String baseUrl,
            String generalModel,
            String analysisModel,
            String privacyPolicyUrl
    ) {
        this.code = code;
        this.displayName = displayName;
        this.baseUrl = baseUrl;
        this.generalModel = generalModel;
        this.analysisModel = analysisModel;
        this.privacyPolicyUrl = privacyPolicyUrl;
    }

    static AiProviderPreset require(String code) {
        String normalized = code == null ? "" : code.strip();
        return Arrays.stream(values())
                .filter(provider -> provider.code.equalsIgnoreCase(normalized))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        ResultCode.BAD_REQUEST.getCode(), "不支持的 AI 服务商"));
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

    String generalModel() {
        return generalModel;
    }

    String analysisModel() {
        return analysisModel;
    }

    String privacyPolicyUrl() {
        return privacyPolicyUrl;
    }
}
