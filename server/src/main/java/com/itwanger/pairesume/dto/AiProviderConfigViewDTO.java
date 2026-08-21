package com.itwanger.pairesume.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AiProviderConfigViewDTO {
    private String displayName;
    private String baseUrl;
    private String generalModel;
    private String analysisModel;
    private String apiKeyMask;
    private boolean apiKeyConfigured;
    private String privacyPolicyUrl;
    private boolean enabled;
    private boolean masterKeyConfigured;
    private LocalDateTime updatedAt;
}
