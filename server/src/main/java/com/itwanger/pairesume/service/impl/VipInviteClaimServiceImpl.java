package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.VipInviteClaimProperties;
import com.itwanger.pairesume.dto.VipInviteClaimCreatedDTO;
import com.itwanger.pairesume.dto.VipInviteClaimResultDTO;
import com.itwanger.pairesume.dto.VipInviteRedemptionDTO;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.entity.VipInviteClaim;
import com.itwanger.pairesume.entity.VipInviteCode;
import com.itwanger.pairesume.entity.VipInviteRedemption;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.mapper.VipInviteClaimMapper;
import com.itwanger.pairesume.mapper.VipInviteCodeMapper;
import com.itwanger.pairesume.mapper.VipInviteRedemptionMapper;
import com.itwanger.pairesume.security.LegalConsentPolicy;
import com.itwanger.pairesume.service.VipInviteClaimService;
import com.itwanger.pairesume.service.VipInviteRateLimitService;
import com.itwanger.pairesume.service.VipInviteService;
import com.itwanger.pairesume.util.DateTimeUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;

@Service
@RequiredArgsConstructor
public class VipInviteClaimServiceImpl implements VipInviteClaimService {

    static final String AWAITING_IDENTITY = "AWAITING_IDENTITY";
    static final String PENDING_CONSENT = "PENDING_CONSENT";
    static final String PENDING_REDEMPTION = "PENDING_REDEMPTION";
    static final String REDEEMED = "REDEEMED";
    static final String EXPIRED = "EXPIRED";
    static final String FAILED = "FAILED";

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String UNAVAILABLE_MESSAGE = "邀请码当前无法领取，账号登录不受影响";

    private final VipInviteClaimMapper claimMapper;
    private final VipInviteCodeMapper inviteCodeMapper;
    private final VipInviteRedemptionMapper redemptionMapper;
    private final UserMapper userMapper;
    private final VipInviteService vipInviteService;
    private final VipInviteRateLimitService rateLimitService;
    private final VipInviteClaimProperties properties;

    @Override
    @Transactional
    public VipInviteClaimCreatedDTO create(String code, String clientIp) {
        String normalizedIp = clientIp == null || clientIp.isBlank()
                ? "missing-ip" : clientIp.trim();
        rateLimitService.acquireIpAttempt(normalizedIp);

        VipInviteCode invite = inviteCodeMapper.selectByCode(normalizeCode(code));
        if (!isAvailable(invite)) {
            // All invalid, expired, exhausted, or unknown campaigns intentionally
            // share one public error so this endpoint cannot be used to enumerate quotas.
            throw new BusinessException(ResultCode.VIP_INVITE_CLAIM_INVALID);
        }

        int ttlSeconds = properties.requireValidTtlSeconds();
        LocalDateTime expiresAt = LocalDateTime.now().plusSeconds(ttlSeconds);
        for (int attempt = 0; attempt < 5; attempt += 1) {
            String claimToken = randomToken();
            VipInviteClaim claim = new VipInviteClaim();
            claim.setTokenHash(sha256(claimToken));
            claim.setInviteCodeId(invite.getId());
            claim.setClaimStatus(AWAITING_IDENTITY);
            claim.setExpiresAt(expiresAt);
            try {
                if (claimMapper.insert(claim) != 1) {
                    throw new IllegalStateException("VIP invite claim was not persisted");
                }
                return new VipInviteClaimCreatedDTO(
                        claimToken,
                        AWAITING_IDENTITY,
                        ttlSeconds,
                        DateTimeUtils.format(expiresAt)
                );
            } catch (DuplicateKeyException ignored) {
                // A token collision is cryptographically implausible but safely retried.
            }
        }
        throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "创建邀请码领取流程失败");
    }

    @Override
    @Transactional(noRollbackFor = BusinessException.class)
    public Long attachToChallenge(String claimToken, String challengeId) {
        validateOpaqueToken(claimToken);
        validateOpaqueToken(challengeId);
        VipInviteClaim claim = claimMapper.selectByTokenHashForUpdate(sha256(claimToken));
        if (claim == null) {
            throw new BusinessException(ResultCode.VIP_INVITE_CLAIM_INVALID);
        }
        if (isExpired(claim)) {
            claim.setClaimStatus(EXPIRED);
            requireUpdated(claimMapper.updateById(claim));
            throw new BusinessException(ResultCode.VIP_INVITE_CLAIM_INVALID);
        }
        if (!AWAITING_IDENTITY.equals(claim.getClaimStatus()) || claim.getUserId() != null) {
            throw new BusinessException(ResultCode.VIP_INVITE_CLAIM_INVALID);
        }

        String challengeHash = sha256(challengeId);
        if (!challengeHash.equals(claim.getChallengeIdHash())) {
            // A claim intentionally outlives one QR image. While no identity is
            // bound, refreshing the QR atomically replaces the old challenge.
            // A late callback from the old QR then fails the hash check in bind.
            claim.setChallengeIdHash(challengeHash);
            requireUpdated(claimMapper.updateById(claim));
        }
        return claim.getId();
    }

    @Override
    public void releaseChallenge(Long claimId, String challengeId) {
        if (claimId == null || !isOpaqueToken(challengeId)) {
            return;
        }
        claimMapper.releaseChallenge(claimId, sha256(challengeId));
    }

    @Override
    @Transactional
    public void bindUserAfterLogin(Long claimId, String challengeId, Long userId) {
        if (claimId == null || userId == null || !isOpaqueToken(challengeId)) {
            return;
        }
        VipInviteClaim claim = claimMapper.selectByIdForUpdate(claimId);
        if (claim == null || isTerminal(claim.getClaimStatus())
                || !sha256(challengeId).equals(claim.getChallengeIdHash())) {
            return;
        }
        if (isExpired(claim)) {
            claim.setClaimStatus(EXPIRED);
            requireUpdated(claimMapper.updateById(claim));
            return;
        }
        if (claim.getUserId() != null && !userId.equals(claim.getUserId())) {
            return;
        }

        User user = userMapper.selectById(userId);
        if (user == null || user.getStatus() == null || user.getStatus() == 0
                || user.getAccountDeletedAt() != null) {
            return;
        }
        if (claim.getUserId() == null) {
            claim.setUserId(userId);
            claim.setBoundAt(LocalDateTime.now());
        }
        claim.setClaimStatus(LegalConsentPolicy.isRequired(user)
                ? PENDING_CONSENT : PENDING_REDEMPTION);
        requireUpdated(claimMapper.updateById(claim));
    }

    @Override
    @Transactional(noRollbackFor = BusinessException.class)
    public VipInviteClaimResultDTO complete(Long userId, String claimToken) {
        validateOpaqueToken(claimToken);
        VipInviteClaim claim = claimMapper.selectByTokenHashForUpdate(sha256(claimToken));
        if (claim == null) {
            throw new BusinessException(ResultCode.VIP_INVITE_CLAIM_INVALID);
        }
        if (claim.getUserId() == null || AWAITING_IDENTITY.equals(claim.getClaimStatus())) {
            throw new BusinessException(ResultCode.VIP_INVITE_CLAIM_NOT_BOUND);
        }
        if (!claim.getUserId().equals(userId)) {
            throw new BusinessException(ResultCode.VIP_INVITE_CLAIM_FORBIDDEN);
        }
        if (REDEEMED.equals(claim.getClaimStatus())) {
            return redeemedResult(claim);
        }
        if (EXPIRED.equals(claim.getClaimStatus()) || isExpired(claim)) {
            claim.setClaimStatus(EXPIRED);
            claim.setFailureCode("CLAIM_EXPIRED");
            requireUpdated(claimMapper.updateById(claim));
            return new VipInviteClaimResultDTO(EXPIRED, "邀请码领取凭证已过期", null);
        }
        if (FAILED.equals(claim.getClaimStatus())) {
            return new VipInviteClaimResultDTO(FAILED, UNAVAILABLE_MESSAGE, null);
        }

        User user = userMapper.selectByIdForUpdate(userId);
        if (user == null || user.getStatus() == null || user.getStatus() == 0
                || user.getAccountDeletedAt() != null) {
            return fail(claim, "ACCOUNT_UNAVAILABLE");
        }
        if (LegalConsentPolicy.isRequired(user)) {
            claim.setClaimStatus(PENDING_CONSENT);
            requireUpdated(claimMapper.updateById(claim));
            throw new BusinessException(ResultCode.LEGAL_CONSENT_REQUIRED);
        }

        try {
            VipInviteRedemptionDTO redemption = vipInviteService.redeemClaim(
                    userId, claim.getInviteCodeId()
            );
            VipInviteRedemption record = redemptionMapper.selectOne(
                    new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<VipInviteRedemption>()
                            .eq(VipInviteRedemption::getUserId, userId)
                            .last("LIMIT 1")
            );
            if (record == null || !claim.getInviteCodeId().equals(record.getInviteCodeId())) {
                throw new IllegalStateException("VIP invite redemption was not persisted");
            }
            claim.setClaimStatus(REDEEMED);
            claim.setRedemptionId(record.getId());
            claim.setCompletedAt(LocalDateTime.now());
            claim.setFailureCode(null);
            requireUpdated(claimMapper.updateById(claim));
            return new VipInviteClaimResultDTO(REDEEMED, "VIP 已领取", redemption);
        } catch (BusinessException exception) {
            return fail(claim, "REDEMPTION_REJECTED_" + exception.getCode());
        }
    }

    private VipInviteClaimResultDTO redeemedResult(VipInviteClaim claim) {
        if (claim.getRedemptionId() == null) {
            throw new IllegalStateException("Redeemed VIP invite claim has no redemption");
        }
        VipInviteRedemption redemption = redemptionMapper.selectById(claim.getRedemptionId());
        if (redemption == null || !claim.getUserId().equals(redemption.getUserId())) {
            throw new IllegalStateException("Redeemed VIP invite claim points to an invalid redemption");
        }
        VipInviteRedemptionDTO dto = new VipInviteRedemptionDTO(
                "ACTIVE",
                DateTimeUtils.format(redemption.getMembershipStartedAt()),
                DateTimeUtils.format(redemption.getMembershipExpiresAt()),
                "VIP_INVITE"
        );
        return new VipInviteClaimResultDTO(REDEEMED, "VIP 已领取", dto);
    }

    private VipInviteClaimResultDTO fail(VipInviteClaim claim, String failureCode) {
        claim.setClaimStatus(FAILED);
        claim.setFailureCode(failureCode);
        claim.setCompletedAt(LocalDateTime.now());
        requireUpdated(claimMapper.updateById(claim));
        return new VipInviteClaimResultDTO(FAILED, UNAVAILABLE_MESSAGE, null);
    }

    private void requireUpdated(int updated) {
        if (updated != 1) {
            throw new IllegalStateException("VIP invite claim state update was lost");
        }
    }

    private boolean isAvailable(VipInviteCode invite) {
        return invite != null
                && "ACTIVE".equals(invite.getInviteStatus())
                && (invite.getExpiresAt() == null || invite.getExpiresAt().isAfter(LocalDateTime.now()))
                && invite.getRedeemedCount() != null
                && invite.getMaxRedemptions() != null
                && invite.getRedeemedCount() < invite.getMaxRedemptions();
    }

    private boolean isTerminal(String status) {
        return REDEEMED.equals(status) || EXPIRED.equals(status) || FAILED.equals(status);
    }

    private boolean isExpired(VipInviteClaim claim) {
        return claim.getExpiresAt() == null || !claim.getExpiresAt().isAfter(LocalDateTime.now());
    }

    private String normalizeCode(String code) {
        return code == null ? "" : code.trim().toUpperCase();
    }

    private void validateOpaqueToken(String value) {
        if (!isOpaqueToken(value)) {
            throw new BusinessException(ResultCode.VIP_INVITE_CLAIM_INVALID);
        }
    }

    private boolean isOpaqueToken(String value) {
        return value != null && value.matches("[A-Za-z0-9_-]{43}");
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
