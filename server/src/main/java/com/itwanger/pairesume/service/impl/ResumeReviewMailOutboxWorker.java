package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.mapper.ResumeReviewMailOutboxMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ResumeReviewMailOutboxWorker {
    private final ResumeReviewMailOutboxMapper outboxMapper;
    private final ResumeReviewMailDeliveryService deliveryService;

    @Scheduled(fixedDelayString = "${app.resume-review.mail-outbox-poll-millis:15000}")
    public void deliverDue() {
        for (Long id : outboxMapper.selectDueIds()) {
            try {
                deliveryService.deliverOne(id);
            } catch (Exception exception) {
                log.warn("Resume review outbox delivery failed outboxId={}, errorType={}",
                        id, exception.getClass().getSimpleName());
            }
        }
    }

}
