package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.config.ResumeReviewProperties;
import com.itwanger.pairesume.entity.ResumeReviewCreditLedger;
import com.itwanger.pairesume.entity.ResumeReviewMailOutbox;
import com.itwanger.pairesume.entity.ResumeReviewRequest;
import com.itwanger.pairesume.mapper.ResumeReviewCreditLedgerMapper;
import com.itwanger.pairesume.mapper.ResumeReviewMailOutboxMapper;
import com.itwanger.pairesume.mapper.ResumeReviewRequestMapper;
import com.itwanger.pairesume.mapper.ResumeReviewAuditLogMapper;
import com.itwanger.pairesume.entity.ResumeReviewAuditLog;
import com.itwanger.pairesume.service.MailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeReviewMailDeliveryService {
    private final ResumeReviewMailOutboxMapper outboxMapper;
    private final ResumeReviewRequestMapper requestMapper;
    private final ResumeReviewCreditLedgerMapper ledgerMapper;
    private final ResumeReviewAuditLogMapper auditMapper;
    private final ResumeReviewPdfRenderer pdfRenderer;
    private final MailService mailService;
    private final ResumeReviewProperties properties;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deliverOne(Long outboxId) {
        if (outboxMapper.claim(outboxId) != 1) return;
        ResumeReviewMailOutbox outbox = outboxMapper.selectByIdForUpdate(outboxId);
        ResumeReviewRequest request = requestMapper.selectByIdForUpdate(outbox.getRequestId());
        if (request == null || !"EMAIL_PENDING".equals(request.getRequestStatus())) {
            outbox.setOutboxStatus("FAILED");
            outbox.setLastErrorType("REQUEST_NOT_DELIVERABLE");
            outbox.setNextAttemptAt(LocalDateTime.now().plusYears(10));
            outboxMapper.updateById(outbox);
            return;
        }
        try {
            if (!StringUtils.hasText(properties.getRecipientEmail())) {
                throw new IllegalStateException("RESUME_REVIEW_RECIPIENT_EMAIL is not configured");
            }
            byte[] pdf = pdfRenderer.render(request.getSnapshotJson());
            mailService.sendResumeReview(properties.getRecipientEmail(), outbox.getMessageId(),
                    request.getRequestNo(), request.getContactEmail(), pdf,
                    "resume-review-" + request.getRequestNo() + ".pdf");
            outbox.setOutboxStatus("SENT");
            outbox.setSentAt(LocalDateTime.now());
            outbox.setLastErrorType(null);
            request.setRequestStatus("EMAILED");
            ResumeReviewCreditLedger ledger = ledgerMapper.selectByRequestForUpdate(request.getId());
            if (ledger != null && "RESERVED".equals(ledger.getLedgerStatus())) {
                ledger.setLedgerStatus("CONSUMED");
                ledgerMapper.updateById(ledger);
            }
            requestMapper.updateById(request);
            auditMapper.insert(audit(request, "EMAIL_SENT", "EMAIL_PENDING", "EMAILED", null));
        } catch (Exception exception) {
            outbox.setOutboxStatus("FAILED");
            outbox.setLastErrorType(exception.getClass().getSimpleName());
            int attempts = outbox.getAttemptCount() == null ? 1 : outbox.getAttemptCount();
            long delayMinutes = Math.min(360, 1L << Math.min(8, attempts));
            outbox.setNextAttemptAt(LocalDateTime.now().plusMinutes(delayMinutes));
            log.warn("Resume review outbox attempt failed outboxId={}, errorType={}",
                    outboxId, exception.getClass().getSimpleName());
            auditMapper.insert(audit(request, "EMAIL_ATTEMPT_FAILED", "EMAIL_PENDING",
                    "EMAIL_PENDING", exception.getClass().getSimpleName()));
        } finally {
            outboxMapper.updateById(outbox);
        }
    }

    private ResumeReviewAuditLog audit(ResumeReviewRequest request, String action,
                                       String from, String to, String reason) {
        ResumeReviewAuditLog audit = new ResumeReviewAuditLog();
        audit.setRequestId(request.getId());
        audit.setRequestNo(request.getRequestNo());
        audit.setActorType("SYSTEM");
        audit.setAction(action);
        audit.setFromStatus(from);
        audit.setToStatus(to);
        audit.setReason(reason);
        return audit;
    }
}
