package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.AiProviderConfigUpdateDTO;
import com.itwanger.pairesume.dto.AiProviderConfigViewDTO;
import com.itwanger.pairesume.dto.AiProviderDisclosureDTO;
import com.itwanger.pairesume.dto.AiProviderTestResultDTO;

public interface AiProviderConfigService {

    AiProviderConfigViewDTO view();

    AiProviderConfigViewDTO update(Long adminUserId, AiProviderConfigUpdateDTO dto);

    AiProviderTestResultDTO testConnection(Long adminUserId);

    void refreshModelAutomatically();

    ActiveAiConfig resolveActive();

    AiProviderDisclosureDTO disclosure();

    record ActiveAiConfig(
            String providerCode,
            String displayName,
            String baseUrl,
            String apiKey,
            String generalModel,
            String analysisModel,
            boolean fromDatabase
    ) {
    }
}
