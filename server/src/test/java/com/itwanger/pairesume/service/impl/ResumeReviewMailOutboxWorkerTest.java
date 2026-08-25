package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumeReviewProperties;
import com.itwanger.pairesume.entity.ResumeReviewCreditLedger;
import com.itwanger.pairesume.entity.ResumeReviewMailOutbox;
import com.itwanger.pairesume.entity.ResumeReviewRequest;
import com.itwanger.pairesume.mapper.ResumeReviewCreditLedgerMapper;
import com.itwanger.pairesume.mapper.ResumeReviewMailOutboxMapper;
import com.itwanger.pairesume.mapper.ResumeReviewRequestMapper;
import com.itwanger.pairesume.mapper.ResumeReviewAuditLogMapper;
import com.itwanger.pairesume.service.MailService;
import com.itwanger.pairesume.service.ResumeReviewObjectStorage;
import com.itwanger.pairesume.service.PlatformConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResumeReviewMailOutboxWorkerTest {
    @Mock private ResumeReviewMailOutboxMapper outboxMapper;
    @Mock private ResumeReviewRequestMapper requestMapper;
    @Mock private ResumeReviewCreditLedgerMapper ledgerMapper;
    @Mock private ResumeReviewAuditLogMapper auditMapper;
    @Mock private ResumeReviewObjectStorage objectStorage;
    @Mock private MailService mailService;
    @Mock private PlatformConfigService platformConfigService;
    private ResumeReviewMailDeliveryService deliveryService;
    private ResumeReviewProperties properties;
    private ResumeReviewMailOutbox outbox;
    private ResumeReviewRequest request;
    private ResumeReviewCreditLedger ledger;

    @BeforeEach
    void setUp() {
        properties = new ResumeReviewProperties();
        properties.setRecipientEmail("review@paicoding.com");
        deliveryService = new ResumeReviewMailDeliveryService(outboxMapper, requestMapper, ledgerMapper, auditMapper,
                objectStorage, mailService, platformConfigService, properties);
        lenient().when(platformConfigService.getResumeReviewRecipientEmail())
                .thenReturn("review@paicoding.com");
        outbox = new ResumeReviewMailOutbox();
        outbox.setId(1L);
        outbox.setRequestId(2L);
        outbox.setMessageId("<resume-review-rr1@resume.paicoding.com>");
        outbox.setAttemptCount(1);
        request = new ResumeReviewRequest();
        request.setId(2L);
        request.setRequestNo("RR1");
        request.setRequestStatus("EMAIL_PENDING");
        request.setContactEmail("contact@example.net");
        request.setPdfObjectKey("pairesume/resume-review/objects/test.pdf");
        request.setPdfSizeBytes(1024L);
        request.setPdfSha256("a".repeat(64));
        ledger = new ResumeReviewCreditLedger();
        ledger.setId(3L);
        ledger.setLedgerStatus("RESERVED");
        lenient().when(outboxMapper.claim(1L)).thenReturn(1);
        lenient().when(outboxMapper.selectByIdForUpdate(1L)).thenReturn(outbox);
        lenient().when(requestMapper.selectByIdForUpdate(2L)).thenReturn(request);
    }

    @Test
    void smtpAcceptanceAtomicallyMarksRequestAndCreditConsumed() {
        when(objectStorage.readVerifiedPdf(
                request.getPdfObjectKey(), request.getPdfSizeBytes(), request.getPdfSha256()))
                .thenReturn("%PDF-1.7".getBytes());
        when(ledgerMapper.selectByRequestForUpdate(2L)).thenReturn(ledger);

        deliveryService.deliverOne(1L);

        assertEquals("EMAILED", request.getRequestStatus());
        assertNotNull(request.getQueuedAt());
        assertEquals("CONSUMED", ledger.getLedgerStatus());
        assertEquals("SENT", outbox.getOutboxStatus());
        verify(mailService).sendResumeReview(eq("review@paicoding.com"),
                eq("<resume-review-rr1@resume.paicoding.com>"), eq("RR1"),
                eq("contact@example.net"), any(byte[].class), anyString());
    }

    @Test
    void mailFailureSchedulesRetryWithoutConsumingCreditOrChangingRequest() {
        when(objectStorage.readVerifiedPdf(
                request.getPdfObjectKey(), request.getPdfSizeBytes(), request.getPdfSha256()))
                .thenReturn("%PDF-1.7".getBytes());
        doThrow(new IllegalStateException("smtp down")).when(mailService)
                .sendResumeReview(anyString(), anyString(), anyString(), anyString(), any(), anyString());

        deliveryService.deliverOne(1L);

        assertEquals("EMAIL_PENDING", request.getRequestStatus());
        assertEquals("FAILED", outbox.getOutboxStatus());
        verifyNoInteractions(ledgerMapper);
    }

    @Test
    void invalidAttachmentStopsAutomaticRetriesForAdminIntervention() {
        when(objectStorage.readVerifiedPdf(
                request.getPdfObjectKey(), request.getPdfSizeBytes(), request.getPdfSha256()))
                .thenThrow(new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_INVALID));

        deliveryService.deliverOne(1L);

        assertEquals("EMAIL_PENDING", request.getRequestStatus());
        assertEquals("FAILED", outbox.getOutboxStatus());
        assertEquals("ATTACHMENT_INVALID", outbox.getLastErrorType());
        assertTrue(outbox.getNextAttemptAt().isAfter(
                java.time.LocalDateTime.now().plusYears(9)));
        verifyNoInteractions(ledgerMapper, mailService);
    }

    @Test
    void exhaustedTransientRetriesStopUntilAdminRetriesOrReturnsRequest() {
        outbox.setAttemptCount(10);
        when(objectStorage.readVerifiedPdf(
                request.getPdfObjectKey(), request.getPdfSizeBytes(), request.getPdfSha256()))
                .thenThrow(new BusinessException(
                        ResultCode.RESUME_REVIEW_STORAGE_UNAVAILABLE));

        deliveryService.deliverOne(1L);

        assertEquals("AUTOMATIC_RETRIES_EXHAUSTED", outbox.getLastErrorType());
        assertTrue(outbox.getNextAttemptAt().isAfter(
                java.time.LocalDateTime.now().plusYears(9)));
        verifyNoInteractions(ledgerMapper, mailService);
    }
}
