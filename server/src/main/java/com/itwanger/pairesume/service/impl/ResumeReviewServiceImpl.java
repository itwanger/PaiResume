package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumeReviewProperties;
import com.itwanger.pairesume.dto.*;
import com.itwanger.pairesume.entity.*;
import com.itwanger.pairesume.mapper.*;
import com.itwanger.pairesume.payment.*;
import com.itwanger.pairesume.security.ResumePhotoSecurityPolicy;
import com.itwanger.pairesume.service.*;
import com.itwanger.pairesume.util.DateTimeUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeReviewServiceImpl implements ResumeReviewService {
    private static final String REVIEW_CONSENT_VERSION = "resume-review-v1";
    private static final String EMAIL_CONSENT_VERSION = "resume-review-email-v1";
    private static final String PAYMENT_DESCRIPTION = "PaiResume 人工简历精修";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final char[] CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ".toCharArray();

    private final ResumeReviewRequestMapper requestMapper;
    private final ResumeReviewCreditLedgerMapper ledgerMapper;
    private final ResumeReviewQuotaIdentityMapper quotaIdentityMapper;
    private final ResumeReviewFollowRewardMapper rewardMapper;
    private final ResumeReviewFollowChallengeMapper challengeMapper;
    private final ResumeReviewFollowFallbackCodeMapper fallbackCodeMapper;
    private final ResumeReviewMailOutboxMapper outboxMapper;
    private final ResumeReviewAuditLogMapper auditMapper;
    private final UserMapper userMapper;
    private final UserAuthIdentityMapper identityMapper;
    private final ResumeService resumeService;
    private final ResumeModuleService moduleService;
    private final PlatformConfigService platformConfigService;
    private final VerificationCodeService verificationCodeService;
    private final MailService mailService;
    private final MarketplacePaymentGateway paymentGateway;
    private final QrCodeDataUrlGenerator qrCodeGenerator;
    private final ResumeReviewProperties properties;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;

    @Override
    public ResumeReviewEligibilityDTO eligibility(Long userId) {
        String subject = quotaSubject(userId);
        boolean welcome = ledgerMapper.selectActiveEntitlement("WELCOME:" + subject) == null;
        ResumeReviewFollowReward reward = rewardMapper.selectBySubject(subject);
        boolean rewardAvailable = reward != null && reward.getConsumedRequestId() == null;
        PlatformConfig config = platformConfigService.getConfigEntity();
        int price = config.getResumeReviewPriceCents() == null ? 0 : config.getResumeReviewPriceCents();
        boolean followAlreadyConsumed = reward != null && reward.getConsumedRequestId() != null;
        boolean paid = followAlreadyConsumed && properties.isPaidAcceptNewOrders()
                && price > 0 && "wechat".equals(paymentGateway.provider());

        ResumeReviewEligibilityDTO dto = new ResumeReviewEligibilityDTO();
        dto.setWelcomeFreeAvailable(welcome);
        dto.setFollowRewardIssued(reward != null);
        dto.setFollowRewardAvailable(rewardAvailable);
        dto.setPaidReviewAvailable(paid);
        dto.setNextEntitlement(welcome ? "WELCOME_FREE"
                : reward == null ? "FOLLOW_REQUIRED"
                : rewardAvailable ? "FOLLOW_REWARD" : "PAID");
        dto.setPriceCents(price);
        dto.setFollowOfficialAccountName(properties.getFollowOfficialAccountName());
        dto.setFollowQrCodeUrl(properties.getFollowQrCodeUrl());
        dto.setNotice(welcome ? "首次人工精修免费"
                : reward == null ? "第二次请关注沉默王二公众号领取一次免费机会"
                : rewardAvailable ? "已获得沉默王二公众号一次关注奖励"
                : paid ? "本次需单独付费，一份快照对应一个订单"
                : "付费精修暂未开放");
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
        ResumeReviewRequest active = requestMapper.selectActive(activeUserKey(userId));
        if (active != null) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_ACTIVE_EXISTS);
        }

        String contactEmail = normalizeEmail(dto.getContactEmail());
        String subject = quotaSubject(userId);
        ResumeReviewFollowReward reward = rewardMapper.selectBySubjectForUpdate(subject);
        String entitlement;
        String entitlementKey;
        int price;
        if (ledgerMapper.selectActiveEntitlement("WELCOME:" + subject) == null) {
            entitlement = "WELCOME_FREE";
            entitlementKey = "WELCOME:" + subject;
            price = 0;
        } else if (reward != null && reward.getConsumedRequestId() == null) {
            entitlement = "FOLLOW_REWARD";
            entitlementKey = "FOLLOW:" + reward.getId();
            price = 0;
        } else if (reward == null) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_REQUIRED);
        } else {
            PlatformConfig config = platformConfigService.getConfigEntity();
            price = config.getResumeReviewPriceCents() == null ? 0 : config.getResumeReviewPriceCents();
            if (!properties.isPaidAcceptNewOrders() || price <= 0
                    || !"wechat".equals(paymentGateway.provider())) {
                throw new BusinessException(ResultCode.RESUME_REVIEW_PAID_NOT_ENABLED);
            }
            entitlement = "PAID";
            entitlementKey = null;
        }

        verifyContactEmail(userId, contactEmail, dto.getVerificationCode());

        Resume resume = resumeService.getByIdAndUserId(dto.getResumeId(), userId);
        List<ResumeModule> modules = moduleService.listByResumeId(dto.getResumeId(), userId);
        ResumePhotoSecurityPolicy.validateModulesForExport(modules);
        String snapshot = snapshotJson(resume, modules);

        ResumeReviewRequest request = new ResumeReviewRequest();
        request.setRequestNo("RR" + compactUuid());
        request.setUserId(userId);
        request.setQuotaSubjectHash(subject);
        request.setResumeId(dto.getResumeId());
        request.setIdempotencyKey(dto.getIdempotencyKey().trim());
        request.setActiveUserKey(activeUserKey(userId));
        request.setContactEmail(contactEmail);
        request.setSnapshotJson(snapshot);
        request.setContentHash(sha256(snapshot));
        LocalDateTime now = LocalDateTime.now();
        request.setReviewConsentVersion(REVIEW_CONSENT_VERSION);
        request.setReviewConsentAt(now);
        request.setEmailConsentVersion(EMAIL_CONSENT_VERSION);
        request.setEmailConsentAt(now);
        request.setEntitlementType(entitlement);
        request.setPriceCents(price);

        if (price == 0) {
            request.setRequestStatus("EMAIL_PENDING");
        } else {
            request.setRequestStatus("AWAITING_PAYMENT");
            request.setOrderNo("PS" + compactUuid());
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

        ResumeReviewCreditLedger ledger = new ResumeReviewCreditLedger();
        ledger.setUserId(userId);
        ledger.setRequestId(request.getId());
        ledger.setCreditType(entitlement);
        ledger.setLedgerStatus("RESERVED");
        ledger.setActiveEntitlementKey(entitlementKey == null ? "PAID:" + request.getOrderNo() : entitlementKey);
        ledgerMapper.insert(ledger);
        if ("FOLLOW_REWARD".equals(entitlement)) {
            reward.setConsumedRequestId(request.getId());
            reward.setConsumedAt(now);
            rewardMapper.updateById(reward);
        }
        audit(request, userId, "USER", "CREATE", null, request.getRequestStatus(), entitlement);

        if (price == 0) {
            createOutbox(request);
        } else {
            createNativePrepay(request, clientIp);
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
    @Transactional
    public ResumeReviewFollowChallengeDTO createFollowChallenge(Long userId) {
        String subject = quotaSubject(userId);
        if (rewardMapper.selectBySubjectForUpdate(subject) != null) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_REWARD_EXISTS);
        }
        ResumeReviewFollowChallenge current = challengeMapper.selectActive("FOLLOW:" + userId);
        LocalDateTime now = LocalDateTime.now();
        if (current != null && current.getExpiresAt().isAfter(now)) {
            return challengeDto(current);
        }
        if (current != null) {
            current.setChallengeStatus("EXPIRED");
            current.setActiveUserKey(null);
            challengeMapper.updateById(current);
        }
        ResumeReviewFollowChallenge challenge = new ResumeReviewFollowChallenge();
        challenge.setChallengeCode(randomCode(16));
        challenge.setUserId(userId);
        challenge.setActiveUserKey("FOLLOW:" + userId);
        challenge.setChallengeStatus("ACTIVE");
        challenge.setExpiresAt(now.plusMinutes(properties.getFollowChallengeExpireMinutes()));
        challengeMapper.insert(challenge);
        return challengeDto(challenge);
    }

    @Override
    @Transactional
    public void handleFollowBridgeEvent(String timestamp, String nonce, String signature, String rawBody) {
        String replayKey = verifyAndClaimBridgeEvent(timestamp, nonce, signature, rawBody);
        if (replayKey == null) {
            // 同一签名事件已在处理或已处理，向公众号网关幂等返回 2xx。
            return;
        }
        boolean transactionSynchronizationActive =
                TransactionSynchronizationManager.isSynchronizationActive();
        if (transactionSynchronizationActive) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status != TransactionSynchronization.STATUS_COMMITTED) {
                        redisTemplate.delete(replayKey);
                    }
                }
            });
        }
        try {
            JsonNode body = objectMapper.readTree(rawBody);
            String openid = requiredText(body, "openid");
            String eventId = requiredText(body, "eventId");
            String content = requiredText(body, "content").trim();
            if (!openid.matches("[A-Za-z0-9_-]{1,128}")
                    || !eventId.matches("[A-Za-z0-9:_-]{1,128}")
                    || content.length() > 128) {
                throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_BRIDGE_INVALID);
            }
            String prefix = "简历精修 ";
            if (!content.startsWith(prefix)) {
                throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_BRIDGE_INVALID);
            }
            String challengeCode = content.substring(prefix.length()).trim().toUpperCase(Locale.ROOT);
            if (!challengeCode.matches("[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{16}")) {
                throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_CODE_INVALID);
            }
            String eventHash = sha256(eventId);
            if (challengeMapper.selectByEventHash(eventHash) != null) {
                return;
            }
            ResumeReviewFollowChallenge challenge = challengeMapper.selectByCodeForUpdate(challengeCode);
            if (challenge != null && "REDEEMED".equals(challenge.getChallengeStatus())
                    && Objects.equals(challenge.getBridgeEventHash(), eventHash)) {
                return;
            }
            if (challenge == null || !"ACTIVE".equals(challenge.getChallengeStatus())
                    || !challenge.getExpiresAt().isAfter(LocalDateTime.now())) {
                throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_CODE_INVALID);
            }
            User user = userMapper.selectByIdForUpdate(challenge.getUserId());
            if (user == null || user.getStatus() == null || user.getStatus() == 0 || user.getAccountDeletedAt() != null) {
                throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_CODE_INVALID);
            }
            String subject = quotaSubject(user.getId());
            issueFollowReward(user.getId(), subject, "WECHAT_BRIDGE", eventHash);
            challenge.setChallengeStatus("REDEEMED");
            challenge.setActiveUserKey(null);
            challenge.setRedeemedAt(LocalDateTime.now());
            challenge.setBridgeEventHash(eventHash);
            challenge.setWechatOpenidHash(sha256(openid));
            challengeMapper.updateById(challenge);
            audit(null, user.getId(), "BRIDGE", "FOLLOW_REWARD_ISSUED", null, null,
                    "WECHAT_BRIDGE");
        } catch (BusinessException exception) {
            if (!transactionSynchronizationActive) redisTemplate.delete(replayKey);
            throw exception;
        } catch (JsonProcessingException exception) {
            if (!transactionSynchronizationActive) redisTemplate.delete(replayKey);
            throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_BRIDGE_INVALID);
        } catch (RuntimeException exception) {
            if (!transactionSynchronizationActive) redisTemplate.delete(replayKey);
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "公众号事件处理暂时失败");
        }
    }

    @Override
    @Transactional
    public void redeemFallbackCode(Long userId, String rawCode) {
        String subject = quotaSubject(userId);
        if (rewardMapper.selectBySubjectForUpdate(subject) != null) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_REWARD_EXISTS);
        }
        String normalized = normalizeCode(rawCode);
        ResumeReviewFollowFallbackCode code = fallbackCodeMapper.selectByHashForUpdate(sha256(normalized));
        if (code == null || !"ISSUED".equals(code.getCodeStatus())
                || !code.getExpiresAt().isAfter(LocalDateTime.now())) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_CODE_INVALID);
        }
        issueFollowReward(userId, subject, "ADMIN_FALLBACK", code.getCodeHash());
        code.setCodeStatus("REDEEMED");
        code.setRedeemedBy(userId);
        code.setRedeemedAt(LocalDateTime.now());
        fallbackCodeMapper.updateById(code);
        audit(null, userId, "USER", "FOLLOW_FALLBACK_REDEEM", null, null,
                "人工故障兜底码，不代表实时关注验证");
    }

    @Override
    public List<ResumeReviewAdminRequestDTO> adminList() {
        return requestMapper.selectAdminQueue().stream().map(this::toAdminDto).toList();
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
            // SMTP 接受前才返还免费额度；一旦已投递，邮件副本无法召回，
            // WELCOME/FOLLOW 必须保持已核销，避免反复发送。
            if (Set.of("AWAITING_PAYMENT", "EMAIL_PENDING").contains(originalStatus)) {
                releaseLedgerAndReward(request);
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
        releaseLedgerAndReward(request);
        try {
            requestMapper.updateById(request);
        } catch (DuplicateKeyException exception) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_REFUND_REFERENCE_CONFLICT);
        }
        return toDto(request);
    }

    @Override
    @Transactional
    public ResumeReviewFallbackCodeDTO adminCreateFallbackCode(Long adminId, int validHours) {
        int hours = Math.max(1, Math.min(validHours, 168));
        String raw = "FR-" + randomCode(24);
        ResumeReviewFollowFallbackCode code = new ResumeReviewFollowFallbackCode();
        code.setCodeHash(sha256(raw));
        code.setCodeHint(raw.substring(raw.length() - 6));
        code.setCodeStatus("ISSUED");
        code.setCreatedBy(adminId);
        code.setExpiresAt(LocalDateTime.now().plusHours(hours));
        fallbackCodeMapper.insert(code);
        return fallbackDto(code, raw);
    }

    @Override
    public List<ResumeReviewFallbackCodeDTO> adminListFallbackCodes() {
        return fallbackCodeMapper.selectAdminList().stream().map(code -> fallbackDto(code, null)).toList();
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
                createOutbox(request);
                audit(request, null, "SYSTEM", "PAYMENT_PAID",
                        previousRequestStatus, "EMAIL_PENDING", null);
            }
        } else if (result.state() == PaymentProviderState.CLOSED
                || result.state() == PaymentProviderState.FAILED) {
            request.setPaymentStatus("CANCELED");
            request.setRequestStatus("RETURNED");
            request.setActiveUserKey(null);
            request.setCodeUrl(null);
            releaseLedgerAndReward(request);
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
        if (result == null || !Objects.equals(request.getOrderNo(), result.orderNo())
                || !Objects.equals(request.getProvider(), paymentGateway.provider())
                || !Objects.equals(paymentGateway.expectedAppId(), result.appId())
                || !Objects.equals(paymentGateway.expectedMerchantId(), result.merchantId())
                || !"CNY".equals(result.currency())) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }
        if (result.amountCents() != null && !Objects.equals(request.getPriceCents(), result.amountCents())) {
            throw new BusinessException(ResultCode.PAYMENT_AMOUNT_MISMATCH);
        }
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

    private String snapshotJson(Resume resume, List<ResumeModule> modules) {
        try {
            Map<String, Object> root = new LinkedHashMap<>();
            root.put("snapshotVersion", 1);
            root.put("resumeTitle", resume.getTitle());
            root.put("templateId", resume.getTemplateId());
            root.put("modules", modules);
            root.put("options", Map.of("templateId",
                    resume.getTemplateId() == null ? "" : resume.getTemplateId()));
            return objectMapper.writeValueAsString(root);
        } catch (Exception exception) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "无法锁定简历快照");
        }
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

    private void releaseLedgerAndReward(ResumeReviewRequest request) {
        ResumeReviewCreditLedger ledger = ledgerMapper.selectByRequestForUpdate(request.getId());
        if (ledger != null && !"RELEASED".equals(ledger.getLedgerStatus())) {
            ledger.setLedgerStatus("RELEASED");
            ledger.setActiveEntitlementKey(null);
            ledgerMapper.updateById(ledger);
        }
        if ("FOLLOW_REWARD".equals(request.getEntitlementType())) {
            ResumeReviewFollowReward reward = rewardMapper.selectBySubjectForUpdate(request.getQuotaSubjectHash());
            if (reward != null && Objects.equals(reward.getConsumedRequestId(), request.getId())) {
                reward.setConsumedRequestId(null);
                reward.setConsumedAt(null);
                rewardMapper.updateById(reward);
            }
        }
    }

    private void issueFollowReward(Long userId, String subject, String sourceType, String referenceHash) {
        if (rewardMapper.selectBySubjectForUpdate(subject) != null) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_REWARD_EXISTS);
        }
        ResumeReviewFollowReward reward = new ResumeReviewFollowReward();
        reward.setUserId(userId);
        reward.setQuotaSubjectHash(subject);
        reward.setSourceType(sourceType);
        reward.setSourceReferenceHash(referenceHash);
        reward.setIssuedAt(LocalDateTime.now());
        try {
            rewardMapper.insert(reward);
        } catch (DuplicateKeyException exception) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_REWARD_EXISTS);
        }
    }

    private String verifyAndClaimBridgeEvent(String timestamp, String nonce, String signature, String rawBody) {
        if (!properties.isFollowBridgeEnabled()
                || !StringUtils.hasText(properties.getFollowBridgeHmacSecret())
                || properties.getFollowBridgeHmacSecret().length() < 32
                || !StringUtils.hasText(timestamp) || !StringUtils.hasText(nonce)
                || !nonce.matches("[A-Za-z0-9_-]{16,128}")
                || !StringUtils.hasText(signature)
                || rawBody == null || rawBody.getBytes(StandardCharsets.UTF_8).length > 8 * 1024) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_BRIDGE_INVALID);
        }
        try {
            long epoch = Long.parseLong(timestamp);
            if (Math.abs(Instant.now().getEpochSecond() - epoch) > Duration.ofMinutes(5).toSeconds()) {
                throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_BRIDGE_INVALID);
            }
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(properties.getFollowBridgeHmacSecret()
                    .getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] expected = mac.doFinal((timestamp + "\n" + nonce + "\n" + rawBody)
                    .getBytes(StandardCharsets.UTF_8));
            byte[] supplied = HexFormat.of().parseHex(signature.trim().toLowerCase(Locale.ROOT));
            if (!MessageDigest.isEqual(expected, supplied)) {
                throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_BRIDGE_INVALID);
            }
            String replayKey = "resume-review:follow-bridge:replay:"
                    + sha256(nonce + ":" + signature).substring(0, 32);
            Boolean first = redisTemplate.opsForValue().setIfAbsent(
                    replayKey, "1", Duration.ofMinutes(10));
            if (!Boolean.TRUE.equals(first)) {
                return null;
            }
            return replayKey;
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_BRIDGE_INVALID);
        }
    }

    private ResumeReviewFollowChallengeDTO challengeDto(ResumeReviewFollowChallenge challenge) {
        String instruction = "请关注“" + properties.getFollowOfficialAccountName()
                + "”公众号并发送：简历精修 " + challenge.getChallengeCode();
        return new ResumeReviewFollowChallengeDTO(challenge.getChallengeCode(),
                properties.getFollowOfficialAccountName(), properties.getFollowQrCodeUrl(),
                instruction, DateTimeUtils.format(challenge.getExpiresAt()));
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
        dto.setEntitlementType(request.getEntitlementType());
        dto.setRequestStatus(request.getRequestStatus());
        dto.setPriceCents(request.getPriceCents());
        dto.setOrderNo(request.getOrderNo());
        dto.setPaymentStatus(request.getPaymentStatus());
        dto.setCodeUrl(request.getCodeUrl());
        if (StringUtils.hasText(request.getCodeUrl())) {
            dto.setQrCodeDataUrl(qrCodeGenerator.generate(request.getCodeUrl()));
        }
        dto.setPaymentExpiresAt(DateTimeUtils.format(request.getPaymentExpiresAt()));
        dto.setPaidAt(DateTimeUtils.format(request.getPaidAt()));
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
        dto.setEntitlementType(request.getEntitlementType());
        dto.setRequestStatus(request.getRequestStatus());
        dto.setPriceCents(request.getPriceCents());
        dto.setOrderNo(request.getOrderNo());
        dto.setProvider(request.getProvider());
        dto.setPayChannel(request.getPayChannel());
        dto.setPaymentStatus(request.getPaymentStatus());
        dto.setProviderTransactionId(request.getProviderTransactionId());
        dto.setPaymentExpiresAt(DateTimeUtils.format(request.getPaymentExpiresAt()));
        dto.setPaidAt(DateTimeUtils.format(request.getPaidAt()));
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

    private ResumeReviewFallbackCodeDTO fallbackDto(ResumeReviewFollowFallbackCode code, String raw) {
        return new ResumeReviewFallbackCodeDTO(code.getId(), raw, code.getCodeHint(),
                code.getCodeStatus(), DateTimeUtils.format(code.getExpiresAt()),
                "此码仅供沉默王二公众号回调故障时人工兜底，不代表实时关注验证；生产应由公众号关键词回调自动签发。");
    }

    private String requiredText(JsonNode body, String field) {
        String value = body.path(field).asText(null);
        if (!StringUtils.hasText(value)) throw new BusinessException(ResultCode.RESUME_REVIEW_FOLLOW_BRIDGE_INVALID);
        return value;
    }

    private String activeUserKey(Long userId) { return "RESUME_REVIEW:" + userId; }
    private String normalizeEmail(String email) {
        if (!StringUtils.hasText(email)) throw new BusinessException(ResultCode.BAD_REQUEST);
        return email.trim().toLowerCase(Locale.ROOT);
    }
    private String normalizeCode(String code) {
        return code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
    }
    private String compactUuid() { return UUID.randomUUID().toString().replace("-", ""); }
    private String randomCode(int length) {
        StringBuilder value = new StringBuilder(length);
        for (int i = 0; i < length; i++) value.append(CODE_ALPHABET[RANDOM.nextInt(CODE_ALPHABET.length)]);
        return value.toString();
    }
    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
