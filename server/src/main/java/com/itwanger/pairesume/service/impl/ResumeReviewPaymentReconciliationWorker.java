package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.mapper.ResumeReviewRequestMapper;
import com.itwanger.pairesume.service.ResumeReviewService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ResumeReviewPaymentReconciliationWorker {
    private final ResumeReviewRequestMapper requestMapper;
    private final ResumeReviewService service;

    @Scheduled(fixedDelayString = "${app.resume-review.payment-reconciliation-poll-millis:30000}")
    public void reconcileExpired() {
        for (Long id : requestMapper.selectExpiredPaymentCandidateIds()) {
            try {
                service.reconcileExpiredPayment(id);
            } catch (Exception exception) {
                log.warn("Resume review payment reconciliation failed requestId={}, errorType={}",
                        id, exception.getClass().getSimpleName());
            }
        }
    }
}
