package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.service.AiProviderConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AiProviderModelRefreshWorker {
    private final AiProviderConfigService service;

    @Scheduled(
            cron = "${ai.provider.model-refresh-cron:0 15 4 * * *}",
            zone = "${ai.provider.model-refresh-zone:Asia/Shanghai}"
    )
    public void refresh() {
        try {
            service.refreshModelAutomatically();
        } catch (Exception e) {
            log.warn("[AI Provider] scheduled model refresh failed: errorType={}",
                    e.getClass().getSimpleName());
        }
    }
}
