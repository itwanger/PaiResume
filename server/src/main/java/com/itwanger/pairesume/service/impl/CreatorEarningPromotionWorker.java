package com.itwanger.pairesume.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class CreatorEarningPromotionWorker {
    private final CreatorEarningPromotionService promotionService;

    @Scheduled(fixedDelayString = "${app.payment.earning-promotion-interval-ms:60000}")
    public void releaseDueEarnings() {
        try {
            for (Long earningId : promotionService.listDueCandidateIds()) {
                promotionService.promoteOne(earningId);
            }
        } catch (RuntimeException exception) {
            log.warn("Creator earning hold release deferred errorType={}",
                    exception.getClass().getSimpleName());
        }
    }
}
