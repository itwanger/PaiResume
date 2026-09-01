package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumeReviewProperties;
import com.itwanger.pairesume.dto.*;
import com.itwanger.pairesume.entity.*;
import com.itwanger.pairesume.mapper.*;
import com.itwanger.pairesume.payment.*;
import com.itwanger.pairesume.service.*;
import com.itwanger.pairesume.util.DateTimeUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeReviewServiceImpl implements ResumeReviewService {
    private static final String REVIEW_CONSENT_VERSION = "resume-review-upload-v2";
    private static final String EMAIL_CONSENT_VERSION = "resume-review-email-v2";
    private static final String PAYMENT_DESCRIPTION = "PaiResume 人工简历精修";
    private static final int MAX_PRIORITY_FEE_CENTS = 100_000;
    private static final long MAX_PDF_BYTES = 5L * 1024L * 1024L;
    private static final byte[] PDF_MAGIC = "%PDF-".getBytes(StandardCharsets.US_ASCII);

    private final ResumeReviewRequestMapper requestMapper;
    private final ResumeReviewCreditLedgerMapper ledgerMapper;
    private final ResumeReviewQuotaIdentityMapper quotaIdentityMapper;
    private final ResumeReviewMailOutboxMapper outboxMapper;
    private final ResumeReviewAuditLogMapper auditMapper;
    private final UserMapper userMapper;
    private final UserAuthIdentityMapper identityMapper;
    private final VerificationCodeService verificationCodeService;
    private final MailService mailService;
    private final PlatformConfigService platformConfigService;
    private final MarketplacePaymentGateway paymentGateway;
    private final QrCodeDataUrlGenerator qrCodeGenerator;
    private final ResumeReviewProperties properties;

    @Override
    public ResumeReviewEligibilityDTO eligibility(Long userId) {
        ResumeReviewEligibilityDTO dto = new ResumeReviewEligibilityDTO();
        User user = userMapper.selectById(userId);
        boolean memberEligible = isActiveMember(user);
        boolean priorityPaymentAvailable = paymentProviderReady();

        dto.setMemberEligible(memberEligible);
        dto.setPaidReviewAvailable(priorityPaymentAvailable);
        dto.setPriceCents(0);
        dto.setMaxPriorityFeeCents(MAX_PRIORITY_FEE_CENTS);
        dto.setNotice(memberEligible
                ? "会员可以免费排队；如需插队，可自选加急金额"
                : "开通派简历会员后才可申请人工精修");
        return dto;
    }

    @Override
    public ResumeReviewRequestDTO current(Long userId) {
        ResumeReviewRequest request = requestMapper.selectActive(activeUserKey(userId));
        return request == null ? null : toDto(request);
    }

    @Override
    public void sendContactVerificationCode(Long userId, String email, String clientIp) {
        String normalized = normalizeEmail(email);
        if (isVerifiedAccountEmail(userId, normalized)) {
            return;
        }
        String code = verificationCodeService.issueResumeReviewContactCode(normalized, clientIp);
        try {
            mailService.sendResumeReviewContactCode(normalized, code);
        } catch (RuntimeException exception) {
            verificationCodeService.rollbackResumeReviewContactCode(normalized);
            throw exception;
        }
    }

    @Override
    @Transactional
    public ResumeReviewRequestDTO create(Long userId, CreateResumeReviewRequestDTO dto, String clientIp) {
        ResumeReviewRequest idempotent = requestMapper.selectIdempotent(userId, dto.getIdempotencyKey().trim());
        if (idempotent != null) {
            return toDto(idempotent);
        }
        User user = userMapper.selectByIdForUpdate(userId);
        if (user == null || user.getStatus() == null || user.getStatus() == 0 || user.getAccountDeletedAt() != null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        if (!isActiveMember(user)) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_MEMBERSHIP_REQUIRED);
        }
        idempotent = requestMapper.selectIdempotent(userId, dto.getIdempotencyKey().trim());
        if (idempotent != null) {
            return toDto(idempotent);
        }
        ResumeReviewRequest active = requestMapper.selectActive(activeUserKey(userId));
        if (active != null) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_ACTIVE_EXISTS);
        }

        String contactEmail = normalizeEmail(dto.getContactEmail());
        String subject = quotaSubject(userId);
        int priorityFee = dto.getPriorityFeeCents() == null ? 0 : dto.getPriorityFeeCents();
        if (priorityFee > 0 && !paymentProviderReady()) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_PAID_NOT_ENABLED);
        }
        if (priorityFee < 0 || priorityFee > MAX_PRIORITY_FEE_CENTS) {
            throw new BusinessException(ResultCode.BAD_REQUEST);
        }
        String fileName = normalizePdfFileName(dto.getFileName());
        String pdfSha256 = dto.getSha256().trim().toLowerCase(Locale.ROOT);

        verifyContactEmail(userId, contactEmail, dto.getVerificationCode());

        ResumeReviewRequest request = new ResumeReviewRequest();
        request.setRequestNo("RR" + compactUuid());
        request.setUserId(userId);
        request.setQuotaSubjectHash(subject);
        request.setResumeId(dto.getResumeId());
        request.setIdempotencyKey(dto.getIdempotencyKey().trim());
        request.setActiveUserKey(activeUserKey(userId));
        request.setContactEmail(contactEmail);
        // snapshot_json remains a non-null legacy column. New requests retain
        // only PDF metadata; the actual bytes go directly to the review inbox.
        request.setSnapshotJson("{}");
        request.setContentHash(pdfSha256);
        request.setPdfObjectKey(null);
        request.setPdfObjectEtag(null);
        request.setPdfOriginalFileName(fileName);
        request.setPdfSizeBytes(dto.getSizeBytes());
        request.setPdfSha256(pdfSha256);
        request.setPdfUploadedAt(null);
        LocalDateTime now = LocalDateTime.now();
        request.setReviewConsentVersion(REVIEW_CONSENT_VERSION);
        request.setReviewConsentAt(now);
        request.setEmailConsentVersion(EMAIL_CONSENT_VERSION);
        request.setEmailConsentAt(now);
        boolean priorityOrder = priorityFee > 0;
        request.setEntitlementType(priorityOrder ? "PAID" : "MEMBERSHIP");
        request.setPriceCents(priorityFee);
        request.setBasePriceCents(0);
        request.setPriorityFeeCents(priorityFee);
        request.setRequestStatus(priorityOrder ? "AWAITING_PAYMENT" : "EMAIL_PENDING");
        if (priorityOrder) {
            request.setOrderNo(PaymentOrderNoGenerator.generate("PS"));
            request.setProvider(paymentGateway.provider());
            request.setPayChannel("NATIVE_QR");
            request.setPaymentStatus("CREATED");
            request.setPaymentExpiresAt(now.plusMinutes(properties.getPaymentOrderExpireMinutes()));
        }
        try {
            requestMapper.insert(request);
        } catch (DuplicateKeyException exception) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_ACTIVE_EXISTS);
        }
        if (priorityOrder) {
            ResumeReviewCreditLedger ledger = new ResumeReviewCreditLedger();
            ledger.setUserId(userId);
            ledger.setRequestId(request.getId());
            ledger.setCreditType("PAID");
            ledger.setLedgerStatus("RESERVED");
            ledger.setActiveEntitlementKey("PAID:" + request.getOrderNo());
            ledgerMapper.insert(ledger);
            audit(request, userId, "USER", "CREATE", null, request.getRequestStatus(), "PRIORITY_PAID");
            createNativePrepay(request, clientIp);
        } else {
            audit(request, userId, "USER", "CREATE", null, request.getRequestStatus(), "MEMBERSHIP_QUEUE");
        }
        return toDto(request);
    }

    @Override
    public ResumeReviewRequestDTO get(Long userId, String requestNo) {
        ResumeReviewRequest request = require(requestNo);
        if (!Objects.equals(request.getUserId(), userId)) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_FORBIDDEN);
        }
        return toDto(request);
    }

    @Override
    @Transactional
    public ResumeReviewRequestDTO updateContactEmail(Long userId, String requestNo,
                                                     String contactEmail, String verificationCode) {
        ResumeReviewRequest request = requireForUpdate(requestNo);
        if (!Objects.equals(request.getUserId(), userId)) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_FORBIDDEN);
        }
        if (!Set.of("AWAITING_PAYMENT", "EMAIL_PENDING").contains(request.getRequestStatus())
                || request.getDispatchedAt() != null || request.getQueuedAt() != null) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_STATE_INVALID);
        }
        String normalized = normalizeEmail(contactEmail);
        if (normalized.equals(normalizeEmail(request.getContactEmail()))) {
            return toDto(request);
        }
        verifyContactEmail(userId, normalized, verificationCode);
        request.setContactEmail(normalized);
        requestMapper.updateById(request);
        audit(request, userId, "USER", "UPDATE_CONTACT_EMAIL",
                request.getRequestStatus(), request.getRequestStatus(), null);
        return toDto(request);
    }

    @Override
    @Transactional
    public ResumeReviewRequestDTO upgradePriority(Long userId, String requestNo,
                                                  Integer priorityFeeCents, String clientIp) {
        ResumeReviewRequest request = requireForUpdate(requestNo);
        if (!Objects.equals(request.getUserId(), userId)) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_FORBIDDEN);
        }
        if ("PAID".equals(request.getEntitlementType())) {
            return toDto(request);
        }
        if (!"MEMBERSHIP".equals(request.getEntitlementType())
                || !"EMAIL_PENDING".equals(request.getRequestStatus())
                || request.getDispatchedAt() != null
                || request.getQueuedAt() != null
                || request.getOrderNo() != null) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_STATE_INVALID);
        }
        int priorityFee = priorityFeeCents == null ? 0 : priorityFeeCents;
        if (priorityFee < 1 || priorityFee > MAX_PRIORITY_FEE_CENTS) {
            throw new BusinessException(ResultCode.BAD_REQUEST);
        }
        if (!paymentProviderReady()) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_PAID_NOT_ENABLED);
        }

        String previousStatus = request.getRequestStatus();
        LocalDateTime now = LocalDateTime.now();
        request.setEntitlementType("PAID");
        request.setPriceCents(priorityFee);
        request.setBasePriceCents(0);
        request.setPriorityFeeCents(priorityFee);
        request.setRequestStatus("AWAITING_PAYMENT");
        request.setOrderNo(PaymentOrderNoGenerator.generate("PS"));
        request.setProvider(paymentGateway.provider());
        request.setPayChannel("NATIVE_QR");
        request.setPaymentStatus("CREATED");
        request.setPaymentExpiresAt(now.plusMinutes(properties.getPaymentOrderExpireMinutes()));

        ResumeReviewCreditLedger ledger = new ResumeReviewCreditLedger();
        ledger.setUserId(userId);
        ledger.setRequestId(request.getId());
        ledger.setCreditType("PAID");
        ledger.setLedgerStatus("RESERVED");
        ledger.setActiveEntitlementKey("PAID:" + request.getOrderNo());
        ledgerMapper.insert(ledger);
        audit(request, userId, "USER", "UPGRADE_PRIORITY", previousStatus,
                "AWAITING_PAYMENT", String.valueOf(priorityFee));
        createNativePrepay(request, clientIp);
        return toDto(request);
    }

    @Override
    @Transactional
    public ResumeReviewRequestDTO refreshPayment(Long userId, String requestNo) {
        ResumeReviewRequest request = requestMapper.selectByRequestNoForUpdate(requestNo);
        if (request == null) throw new BusinessException(ResultCode.RESUME_REVIEW_NOT_FOUND);
        if (!Objects.equals(request.getUserId(), userId)) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_FORBIDDEN);
        }
        if (!"PAID".equals(request.getEntitlementType()) || request.getOrderNo() == null
                || Set.of("PAID", "REFUND_REQUIRED", "REFUNDED").contains(request.getPaymentStatus())) {
            return toDto(request);
        }
        ProviderPaymentResult result = paymentGateway.queryOrder(request.getOrderNo());
        applyProviderResult(request, result);
        return toDto(request);
    }

    @Override
    @Transactional
    public ResumeReviewRequestDTO dispatch(Long userId, String requestNo, MultipartFile file) {
        ResumeReviewRequest request = requestMapper.selectByRequestNoForUpdate(requestNo);
        if (request == null) throw new BusinessException(ResultCode.RESUME_REVIEW_NOT_FOUND);
        if (!Objects.equals(request.getUserId(), userId)) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_FORBIDDEN);
        }
        if (Set.of("EMAILED", "ACCEPTED", "COMPLETED").contains(request.getRequestStatus())) {
            return toDto(request);
        }
        if (!"EMAIL_PENDING".equals(request.getRequestStatus())) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_STATE_INVALID);
        }
        if ("PAID".equals(request.getEntitlementType()) && !"PAID".equals(request.getPaymentStatus())) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_STATE_INVALID);
        }
        byte[] pdf = validateDispatchPdf(request, file);
        String recipientEmail = platformConfigService.getResumeReviewRecipientEmail();
        if (!StringUtils.hasText(recipientEmail)) {
            throw new BusinessException(ResultCode.MAIL_NOT_CONFIGURED);
        }
        String messageId = "<resume-review-" + request.getRequestNo().toLowerCase(Locale.ROOT)
                + "@" + properties.getMessageIdDomain() + ">";
        mailService.sendResumeReview(recipientEmail, messageId, request.getRequestNo(),
                request.getContactEmail(), pdf, request.getPdfOriginalFileName());

        LocalDateTime now = LocalDateTime.now();
        request.setDispatchedAt(now);
        request.setPdfUploadedAt(now);
        request.setQueuedAt(now);
        request.setRequestStatus("EMAILED");
        requestMapper.updateById(request);
        consumeLedger(request.getId());
        audit(request, userId, "USER", "DISPATCH", "EMAIL_PENDING", "EMAILED", null);
        return toDto(request);
    }

    @Override
    public List<ResumeReviewQueueItemDTO> publicQueue() {
        List<ResumeReviewRequest> requests = requestMapper.selectPublicQueue();
        List<ResumeReviewQueueItemDTO> queue = new ArrayList<>(requests.size());
        for (int index = 0; index < requests.size(); index++) {
            ResumeReviewRequest request = requests.get(index);
            ResumeReviewQueueItemDTO dto = new ResumeReviewQueueItemDTO();
            dto.setPosition(index + 1);
            dto.setPublicCode(publicQueueCode(request.getRequestNo()));
            dto.setQueueStatus("ACCEPTED".equals(request.getRequestStatus())
                    ? "IN_PROGRESS" : "WAITING");
            int priorityFee = request.getPriorityFeeCents() == null ? 0 : request.getPriorityFeeCents();
            dto.setPriority(priorityFee > 0);
            dto.setPriorityFeeCents(priorityFee);
            dto.setPaidAmountCents(request.getPriceCents() == null ? 0 : request.getPriceCents());
            dto.setQueuedAt(DateTimeUtils.format(request.getQueuedAt()));
            queue.add(dto);
        }
        return queue;
    }

    @Override
    @Transactional
    public void handleVerifiedProviderNotification(ProviderPaymentResult result) {
        if (result == null || !StringUtils.hasText(result.orderNo()) || !result.orderNo().startsWith("PS")) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }
        ResumeReviewRequest request = requestMapper.selectByOrderNoForUpdate(result.orderNo());
        if (request == null) throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        applyProviderResult(request, result);
    }

    @Override
    @Transactional
    public void reconcileExpiredPayment(Long requestId) {
        ResumeReviewRequest request = requestMapper.selectByIdForUpdate(requestId);
        if (request == null || !"PAID".equals(request.getEntitlementType())
                || !Set.of("CREATED", "PREPAY_UNKNOWN", "PENDING").contains(request.getPaymentStatus())
                || request.getPaymentExpiresAt() == null
                || request.getPaymentExpiresAt().isAfter(LocalDateTime.now())) {
            return;
        }
        ProviderPaymentResult beforeClose = paymentGateway.queryOrder(request.getOrderNo());
        if (beforeClose.state() == PaymentProviderState.PAID) {
            applyProviderResult(request, beforeClose);
            return;
        }
        if (beforeClose.state() == PaymentProviderState.PENDING) {
            paymentGateway.closeOrder(request.getOrderNo());
            ProviderPaymentResult afterClose = paymentGateway.queryOrder(request.getOrderNo());
            applyProviderResult(request, afterClose);
            return;
        }
        applyProviderResult(request, beforeClose);
    }

    @Override
    public List<ResumeReviewAdminRequestDTO> adminList() {
        return requestMapper.selectAdminQueue().stream().map(this::toAdminDto).toList();
    }

    @Override
    public long adminActionCount() {
        return requestMapper.countAdminActionQueue();
    }

    @Override
    public ResumeReviewAdminRequestDTO adminGet(String requestNo) {
        return toAdminDto(require(requestNo));
    }

    @Override
    public List<ResumeReviewAuditDTO> adminAudits(String requestNo) {
        require(requestNo);
        return auditMapper.selectByRequestNo(requestNo).stream().map(logEntry -> {
            ResumeReviewAuditDTO dto = new ResumeReviewAuditDTO();
            dto.setId(logEntry.getId());
            dto.setRequestNo(logEntry.getRequestNo());
            dto.setActorUserId(logEntry.getActorUserId());
            dto.setActorType(logEntry.getActorType());
            dto.setAction(logEntry.getAction());
            dto.setFromStatus(logEntry.getFromStatus());
            dto.setToStatus(logEntry.getToStatus());
            dto.setReason(logEntry.getReason());
            dto.setCreatedAt(DateTimeUtils.format(logEntry.getCreatedAt()));
            return dto;
        }).toList();
    }

    @Override
    @Transactional
    public ResumeReviewRequestDTO adminAccept(String requestNo, Long adminId, String reason) {
        ResumeReviewRequest request = requireForUpdate(requestNo);
        if (!"EMAILED".equals(request.getRequestStatus())) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_STATE_INVALID);
        }
        transition(request, adminId, "ACCEPT", "ACCEPTED", reason);
        request.setHandledBy(adminId);
        request.setAcceptedAt(LocalDateTime.now());
        requestMapper.updateById(request);
        return toDto(request);
    }

    @Override
    @Transactional
    public ResumeReviewRequestDTO adminComplete(String requestNo, Long adminId, String reason) {
        ResumeReviewRequest request = requireForUpdate(requestNo);
        if (!"ACCEPTED".equals(request.getRequestStatus())) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_STATE_INVALID);
        }
        transition(request, adminId, "COMPLETE", "COMPLETED", reason);
        request.setHandledBy(adminId);
        request.setCompletedAt(LocalDateTime.now());
        request.setActiveUserKey(null);
        requestMapper.updateById(request);
        return toDto(request);
    }

    @Override
    @Transactional
    public ResumeReviewRequestDTO adminReturn(String requestNo, Long adminId, String reason) {
        ResumeReviewRequest request = requireForUpdate(requestNo);
        if (!Set.of("AWAITING_PAYMENT", "EMAIL_PENDING", "EMAILED", "ACCEPTED")
                .contains(request.getRequestStatus())) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_STATE_INVALID);
        }
        request.setHandledBy(adminId);
        request.setReturnedAt(LocalDateTime.now());
        String originalStatus = request.getRequestStatus();
        if (request.getPaidAt() != null) {
            request.setRefundReason(reason);
            transition(request, adminId, "RETURN_REFUND_REQUIRED", "REFUND_REQUIRED", reason);
            request.setPaymentStatus("REFUND_REQUIRED");
        } else {
            transition(request, adminId, "RETURN_AND_RELEASE", "RETURNED", reason);
            request.setActiveUserKey(null);
            // 未付款的新订单以及历史免费请求均只释放流水；
            // 旧的免费权益不再重新签发。
            if (Set.of("AWAITING_PAYMENT", "EMAIL_PENDING").contains(originalStatus)) {
                releaseLedger(request);
            }
        }
        requestMapper.updateById(request);
        return toDto(request);
    }

    @Override
    @Transactional
    public ResumeReviewRequestDTO adminRetryMail(String requestNo, Long adminId, String reason) {
        ResumeReviewRequest request = requireForUpdate(requestNo);
        if (!"EMAIL_PENDING".equals(request.getRequestStatus())) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_STATE_INVALID);
        }
        ResumeReviewMailOutbox outbox = outboxMapper.selectByRequestForUpdate(request.getId());
        if (outbox == null) createOutbox(request);
        else {
            outbox.setOutboxStatus("PENDING");
            outbox.setNextAttemptAt(LocalDateTime.now());
            outbox.setLastErrorType(null);
            outboxMapper.updateById(outbox);
        }
        audit(request, adminId, "ADMIN", "MAIL_RETRY", request.getRequestStatus(),
                request.getRequestStatus(), reason);
        return toDto(request);
    }

    @Override
    @Transactional
    public ResumeReviewRequestDTO adminConfirmRefund(String requestNo, Long adminId,
                                                     String refundReference, String reason) {
        ResumeReviewRequest request = requireForUpdate(requestNo);
        if (!"REFUND_REQUIRED".equals(request.getRequestStatus())) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_STATE_INVALID);
        }
        request.setRefundReference(refundReference.trim());
        request.setPaymentStatus("REFUNDED");
        request.setHandledBy(adminId);
        transition(request, adminId, "CONFIRM_REFUND", "REFUNDED", reason);
        request.setActiveUserKey(null);
        releaseLedger(request);
        try {
            requestMapper.updateById(request);
        } catch (DuplicateKeyException exception) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_REFUND_REFERENCE_CONFLICT);
        }
        return toDto(request);
    }

    private void createNativePrepay(ResumeReviewRequest request, String clientIp) {
        try {
            PaymentPrepayResult prepay = paymentGateway.createNativeOrder(new PaymentPrepayRequest(
                    request.getOrderNo(), PAYMENT_DESCRIPTION, request.getPriceCents(),
                    StringUtils.hasText(clientIp) ? clientIp : "127.0.0.1", request.getPaymentExpiresAt()));
            if (prepay == null || !StringUtils.hasText(prepay.codeUrl())) {
                throw new IllegalStateException("empty prepay response");
            }
            qrCodeGenerator.generate(prepay.codeUrl());
            request.setProviderPrepayId(prepay.providerPrepayId());
            request.setCodeUrl(prepay.codeUrl());
            request.setPaymentStatus("PENDING");
        } catch (Exception exception) {
            request.setPaymentStatus("PREPAY_UNKNOWN");
            log.warn("Resume review Native prepay uncertain requestNo={}, errorType={}",
                    request.getRequestNo(), exception.getClass().getSimpleName());
        }
        requestMapper.updateById(request);
    }

    private void applyProviderResult(ResumeReviewRequest request, ProviderPaymentResult result) {
        String previousRequestStatus = request.getRequestStatus();
        verifyPayment(request, result);
        if ("REFUNDED".equals(request.getPaymentStatus())) return;
        if (result.state() == PaymentProviderState.PAID) {
            if ("PAID".equals(request.getPaymentStatus())) return;
            ResumeReviewRequest owner = requestMapper.selectByProviderTransaction(
                    request.getProvider(), result.transactionId());
            if (owner != null && !Objects.equals(owner.getId(), request.getId())) {
                throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
            }
            request.setProviderTransactionId(result.transactionId());
            request.setPaidAt(result.paidAt());
            request.setCodeUrl(null);
            boolean eligible = "AWAITING_PAYMENT".equals(request.getRequestStatus())
                    && request.getActiveUserKey() != null
                    && request.getPaymentExpiresAt() != null
                    && !result.paidAt().isAfter(request.getPaymentExpiresAt());
            if (!eligible) {
                request.setPaymentStatus("REFUND_REQUIRED");
                request.setRequestStatus("REFUND_REQUIRED");
                request.setRefundReason("LATE_OR_INACTIVE_PAYMENT");
                log.error("payment_alert event=RESUME_REVIEW_REFUND_REQUIRED requestNo={} reason={}",
                        request.getRequestNo(), request.getRefundReason());
                audit(request, null, "SYSTEM", "PAYMENT_REFUND_REQUIRED",
                        previousRequestStatus, "REFUND_REQUIRED", request.getRefundReason());
            } else {
                request.setPaymentStatus("PAID");
                request.setRequestStatus("EMAIL_PENDING");
                audit(request, null, "SYSTEM", "PAYMENT_PAID",
                        previousRequestStatus, "EMAIL_PENDING", null);
            }
        } else if (result.state() == PaymentProviderState.CLOSED
                || result.state() == PaymentProviderState.FAILED) {
            request.setPaymentStatus("CANCELED");
            request.setRequestStatus("RETURNED");
            request.setActiveUserKey(null);
            request.setCodeUrl(null);
            releaseLedger(request);
            audit(request, null, "SYSTEM", "PAYMENT_CANCELED",
                    previousRequestStatus, "RETURNED", result.state().name());
        } else if (result.state() == PaymentProviderState.REFUND_PENDING_VERIFICATION
                || result.state() == PaymentProviderState.REFUNDED) {
            request.setPaymentStatus("REFUND_REQUIRED");
            request.setRequestStatus("REFUND_REQUIRED");
            request.setRefundReason("PROVIDER_REFUND_REQUIRES_MANUAL_CONFIRMATION");
            audit(request, null, "SYSTEM", "PROVIDER_REFUND_REVIEW",
                    previousRequestStatus, "REFUND_REQUIRED", request.getRefundReason());
        }
        requestMapper.updateById(request);
    }

    private void verifyPayment(ResumeReviewRequest request, ProviderPaymentResult result) {
        ProviderPaymentResultValidator.verifyIdentityAndAmount(
                request.getOrderNo(), request.getProvider(), request.getPriceCents(), paymentGateway, result);
        if (result.state() == PaymentProviderState.PAID
                && (!StringUtils.hasText(result.transactionId()) || result.paidAt() == null
                || result.amountCents() == null)) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }
    }

    private void verifyContactEmail(Long userId, String email, String code) {
        if (isVerifiedAccountEmail(userId, email)) return;
        if (!StringUtils.hasText(code)) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_EMAIL_NOT_VERIFIED);
        }
        VerificationCodeService.ConsumeResult result =
                verificationCodeService.consumeResumeReviewContactCode(email, code.trim());
        if (result != VerificationCodeService.ConsumeResult.VERIFIED) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_EMAIL_NOT_VERIFIED);
        }
    }

    private boolean isVerifiedAccountEmail(Long userId, String email) {
        UserAuthIdentity identity = identityMapper.selectOne(new LambdaQueryWrapper<UserAuthIdentity>()
                .eq(UserAuthIdentity::getUserId, userId)
                .eq(UserAuthIdentity::getProvider, "EMAIL_PASSWORD")
                .eq(UserAuthIdentity::getPrincipal, email)
                .eq(UserAuthIdentity::getStatus, 1)
                .isNotNull(UserAuthIdentity::getVerifiedAt)
                .last("LIMIT 1"));
        return identity != null;
    }

    private String quotaSubject(Long userId) {
        List<UserAuthIdentity> identities = identityMapper.selectList(
                new LambdaQueryWrapper<UserAuthIdentity>()
                        .eq(UserAuthIdentity::getUserId, userId)
                        .eq(UserAuthIdentity::getStatus, 1)
                        .in(UserAuthIdentity::getProvider, "WECHAT_SERVICE", "EMAIL_PASSWORD")
                        .orderByDesc(UserAuthIdentity::getProvider));
        if (identities.isEmpty()) throw new BusinessException(ResultCode.USER_NOT_FOUND);
        List<String> identityHashes = identities.stream()
                .map(identity -> sha256(identity.getProvider() + ":"
                        + identity.getPrincipal().trim().toLowerCase(Locale.ROOT)))
                .distinct().toList();
        ResumeReviewQuotaIdentity existing = quotaIdentityMapper.selectAny(identityHashes);
        String subject = existing == null ? identityHashes.get(0) : existing.getQuotaSubjectHash();
        for (String identityHash : identityHashes) {
            ResumeReviewQuotaIdentity alias = quotaIdentityMapper.selectById(identityHash);
            if (alias != null) {
                if (!Objects.equals(alias.getQuotaSubjectHash(), subject)) {
                    throw new IllegalStateException("Conflicting resume review quota subjects require manual reconciliation");
                }
                continue;
            }
            alias = new ResumeReviewQuotaIdentity();
            alias.setIdentityHash(identityHash);
            alias.setQuotaSubjectHash(subject);
            alias.setFirstUserId(userId);
            try {
                quotaIdentityMapper.insert(alias);
            } catch (DuplicateKeyException exception) {
                ResumeReviewQuotaIdentity winner = quotaIdentityMapper.selectById(identityHash);
                if (winner == null || !Objects.equals(winner.getQuotaSubjectHash(), subject)) {
                    throw new IllegalStateException("Unable to establish resume review quota subject", exception);
                }
            }
        }
        return subject;
    }

    private void createOutbox(ResumeReviewRequest request) {
        if (outboxMapper.selectByRequestForUpdate(request.getId()) != null) return;
        ResumeReviewMailOutbox outbox = new ResumeReviewMailOutbox();
        outbox.setRequestId(request.getId());
        outbox.setMessageId("<resume-review-" + request.getRequestNo().toLowerCase(Locale.ROOT)
                + "@" + properties.getMessageIdDomain() + ">");
        outbox.setOutboxStatus("PENDING");
        outbox.setAttemptCount(0);
        outbox.setNextAttemptAt(LocalDateTime.now());
        outboxMapper.insert(outbox);
    }

    private void consumeLedger(Long requestId) {
        ResumeReviewCreditLedger ledger = ledgerMapper.selectByRequestForUpdate(requestId);
        if (ledger != null && !"RELEASED".equals(ledger.getLedgerStatus())) {
            ledger.setLedgerStatus("CONSUMED");
            ledgerMapper.updateById(ledger);
        }
    }

    private void releaseLedger(ResumeReviewRequest request) {
        ResumeReviewCreditLedger ledger = ledgerMapper.selectByRequestForUpdate(request.getId());
        if (ledger != null && !"RELEASED".equals(ledger.getLedgerStatus())) {
            ledger.setLedgerStatus("RELEASED");
            ledger.setActiveEntitlementKey(null);
            ledgerMapper.updateById(ledger);
        }
    }

    private ResumeReviewRequest require(String requestNo) {
        ResumeReviewRequest request = requestMapper.selectByRequestNo(requestNo);
        if (request == null) throw new BusinessException(ResultCode.RESUME_REVIEW_NOT_FOUND);
        return request;
    }

    private ResumeReviewRequest requireForUpdate(String requestNo) {
        ResumeReviewRequest request = requestMapper.selectByRequestNoForUpdate(requestNo);
        if (request == null) throw new BusinessException(ResultCode.RESUME_REVIEW_NOT_FOUND);
        return request;
    }

    private void transition(ResumeReviewRequest request, Long actor, String action,
                            String status, String reason) {
        String from = request.getRequestStatus();
        request.setRequestStatus(status);
        audit(request, actor, "ADMIN", action, from, status, reason);
    }

    private void audit(ResumeReviewRequest request, Long actor, String actorType, String action,
                       String from, String to, String reason) {
        ResumeReviewAuditLog audit = new ResumeReviewAuditLog();
        audit.setRequestId(request == null ? null : request.getId());
        audit.setRequestNo(request == null ? null : request.getRequestNo());
        audit.setActorUserId(actor);
        audit.setActorType(actorType);
        audit.setAction(action);
        audit.setFromStatus(from);
        audit.setToStatus(to);
        audit.setReason(reason);
        auditMapper.insert(audit);
    }

    private ResumeReviewRequestDTO toDto(ResumeReviewRequest request) {
        ResumeReviewRequestDTO dto = new ResumeReviewRequestDTO();
        dto.setRequestNo(request.getRequestNo());
        dto.setResumeId(request.getResumeId());
        dto.setContactEmail(request.getContactEmail());
        dto.setContentHash(request.getContentHash());
        dto.setPdfFileName(request.getPdfOriginalFileName());
        dto.setPdfSizeBytes(request.getPdfSizeBytes());
        dto.setEntitlementType(request.getEntitlementType());
        dto.setRequestStatus(request.getRequestStatus());
        dto.setPriceCents(request.getPriceCents());
        dto.setBasePriceCents(request.getBasePriceCents());
        dto.setPriorityFeeCents(request.getPriorityFeeCents());
        dto.setOrderNo(request.getOrderNo());
        dto.setPaymentStatus(request.getPaymentStatus());
        dto.setCodeUrl(request.getCodeUrl());
        if (StringUtils.hasText(request.getCodeUrl())) {
            dto.setQrCodeDataUrl(qrCodeGenerator.generate(request.getCodeUrl()));
        }
        dto.setPaymentExpiresAt(DateTimeUtils.format(request.getPaymentExpiresAt()));
        dto.setPaidAt(DateTimeUtils.format(request.getPaidAt()));
        dto.setDispatchedAt(DateTimeUtils.format(request.getDispatchedAt()));
        dto.setQueuedAt(DateTimeUtils.format(request.getQueuedAt()));
        dto.setCreatedAt(DateTimeUtils.format(request.getCreatedAt()));
        dto.setRefundReason(request.getRefundReason());
        return dto;
    }

    private ResumeReviewAdminRequestDTO toAdminDto(ResumeReviewRequest request) {
        ResumeReviewAdminRequestDTO dto = new ResumeReviewAdminRequestDTO();
        dto.setRequestNo(request.getRequestNo());
        dto.setUserId(request.getUserId());
        dto.setResumeId(request.getResumeId());
        dto.setContactEmail(request.getContactEmail());
        dto.setContentHash(request.getContentHash());
        dto.setPdfFileName(request.getPdfOriginalFileName());
        dto.setPdfSizeBytes(request.getPdfSizeBytes());
        dto.setEntitlementType(request.getEntitlementType());
        dto.setRequestStatus(request.getRequestStatus());
        dto.setPriceCents(request.getPriceCents());
        dto.setBasePriceCents(request.getBasePriceCents());
        dto.setPriorityFeeCents(request.getPriorityFeeCents());
        dto.setOrderNo(request.getOrderNo());
        dto.setProvider(request.getProvider());
        dto.setPayChannel(request.getPayChannel());
        dto.setPaymentStatus(request.getPaymentStatus());
        dto.setProviderTransactionId(request.getProviderTransactionId());
        dto.setPaymentExpiresAt(DateTimeUtils.format(request.getPaymentExpiresAt()));
        dto.setPaidAt(DateTimeUtils.format(request.getPaidAt()));
        dto.setQueuedAt(DateTimeUtils.format(request.getQueuedAt()));
        dto.setRefundReason(request.getRefundReason());
        dto.setRefundReference(request.getRefundReference());
        dto.setHandledBy(request.getHandledBy());
        dto.setAcceptedAt(DateTimeUtils.format(request.getAcceptedAt()));
        dto.setCompletedAt(DateTimeUtils.format(request.getCompletedAt()));
        dto.setReturnedAt(DateTimeUtils.format(request.getReturnedAt()));
        dto.setCreatedAt(DateTimeUtils.format(request.getCreatedAt()));
        ResumeReviewMailOutbox outbox = outboxMapper.selectByRequest(request.getId());
        if (outbox != null) {
            dto.setMailStatus(outbox.getOutboxStatus());
            dto.setMailAttemptCount(outbox.getAttemptCount());
            dto.setMailLastErrorType(outbox.getLastErrorType());
            dto.setMailNextAttemptAt(DateTimeUtils.format(outbox.getNextAttemptAt()));
            dto.setMailSentAt(DateTimeUtils.format(outbox.getSentAt()));
        }
        return dto;
    }

    private String activeUserKey(Long userId) { return "RESUME_REVIEW:" + userId; }
    private boolean paymentProviderReady() {
        String provider = paymentGateway.provider();
        return "wechat".equals(provider) || "mock".equals(provider);
    }
    private boolean isActiveMember(User user) {
        return user != null && "ACTIVE".equals(user.getMembershipStatus())
                && (user.getMembershipExpiresAt() == null
                || user.getMembershipExpiresAt().isAfter(LocalDateTime.now()));
    }
    private String publicQueueCode(String requestNo) {
        if (!StringUtils.hasText(requestNo)) return "精修单";
        String normalized = requestNo.trim();
        int start = Math.max(0, normalized.length() - 8);
        return "精修单 · " + normalized.substring(start).toUpperCase(Locale.ROOT);
    }
    private String normalizeEmail(String email) {
        if (!StringUtils.hasText(email)) throw new BusinessException(ResultCode.BAD_REQUEST);
        return email.trim().toLowerCase(Locale.ROOT);
    }
    private String normalizePdfFileName(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_INVALID);
        }
        String normalized = fileName.replace('\\', '/');
        normalized = normalized.substring(normalized.lastIndexOf('/') + 1)
                .replaceAll("[\\p{Cntrl}]", "").trim();
        if (normalized.isEmpty() || normalized.length() > 200
                || !normalized.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_INVALID);
        }
        return normalized;
    }
    private byte[] validateDispatchPdf(ResumeReviewRequest request, MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() < PDF_MAGIC.length
                || file.getSize() > MAX_PDF_BYTES
                || request.getPdfSizeBytes() == null
                || file.getSize() != request.getPdfSizeBytes()) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_INVALID);
        }
        String contentType = file.getContentType();
        if (StringUtils.hasText(contentType)
                && !"application/pdf".equalsIgnoreCase(contentType.trim())) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_INVALID);
        }
        String fileName = normalizePdfFileName(file.getOriginalFilename());
        if (!fileName.equals(request.getPdfOriginalFileName())) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_INVALID);
        }
        try {
            byte[] pdf = file.getBytes();
            if (pdf.length != file.getSize()) {
                throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_INVALID);
            }
            for (int index = 0; index < PDF_MAGIC.length; index++) {
                if (pdf[index] != PDF_MAGIC[index]) {
                    throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_INVALID);
                }
            }
            String actualSha256 = sha256(pdf);
            if (!actualSha256.equalsIgnoreCase(request.getPdfSha256())) {
                throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_INVALID);
            }
            return pdf;
        } catch (IOException exception) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_INVALID);
        }
    }
    private String compactUuid() { return UUID.randomUUID().toString().replace("-", ""); }
    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
    private String sha256(byte[] value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
