package com.itwanger.pairesume.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class AiProviderConfigViewDTO {
    private String providerCode;
    private String displayName;
    private String baseUrl;
    private String generalModel;
    private String analysisModel;
    private List<AiProviderModelOptionDTO> availableModels;
    private String apiKeyMask;
    private boolean apiKeyConfigured;
    private String privacyPolicyUrl;
    private boolean autoUpgrade;
    private boolean enabled;
    private boolean masterKeyConfigured;
    private LocalDateTime updatedAt;
}
