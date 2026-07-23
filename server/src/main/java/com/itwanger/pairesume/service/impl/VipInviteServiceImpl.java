package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.CreateVipInviteDTO;
import com.itwanger.pairesume.dto.VipInviteAdminDTO;
import com.itwanger.pairesume.dto.VipInviteRedemptionDTO;
import com.itwanger.pairesume.dto.VipInviteRedemptionAdminDTO;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.entity.VipInviteCode;
import com.itwanger.pairesume.entity.VipInviteRedemption;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.mapper.VipInviteCodeMapper;
import com.itwanger.pairesume.mapper.VipInviteRedemptionMapper;
import com.itwanger.pairesume.service.VipInviteService;
import com.itwanger.pairesume.service.MembershipAuditService;
import com.itwanger.pairesume.service.VipInviteRateLimitService;
import com.itwanger.pairesume.util.DateTimeUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class VipInviteServiceImpl implements VipInviteService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int DEFAULT_MEMBERSHIP_DAYS = 30;
    private static final int DEFAULT_MAX_REDEMPTIONS = 100;
    private static final int DEFAULT_EXPIRES_IN_DAYS = 30;

    private final VipInviteCodeMapper vipInviteCodeMapper;
    private final VipInviteRedemptionMapper vipInviteRedemptionMapper;
    private final UserMapper userMapper;
    private final MembershipAuditService membershipAuditService;
    private final VipInviteRateLimitService vipInviteRateLimitService;

    @Override
    @Transactional
    public VipInviteAdminDTO create(Long adminUserId, CreateVipInviteDTO dto) {
        for (int attempt = 0; attempt < 10; attempt += 1) {
            VipInviteCode invite = new VipInviteCode();
            invite.setCode(buildCode());
            invite.setInviteStatus("ACTIVE");
            invite.setRemark(normalizeRemark(dto == null ? null : dto.getRemark()));
            invite.setCreatedBy(adminUserId);
            invite.setMaxRedemptions(dto != null && dto.getMaxRedemptions() != null
                    ? dto.getMaxRedemptions() : DEFAULT_MAX_REDEMPTIONS);
            invite.setRedeemedCount(0);
            int membershipDays = dto != null && dto.getMembershipDays() != null
                    ? dto.getMembershipDays() : DEFAULT_MEMBERSHIP_DAYS;
            invite.setMembershipDays(membershipDays);
            int expiresInDays = dto != null && dto.getExpiresInDays() != null
                    ? dto.getExpiresInDays() : DEFAULT_EXPIRES_IN_DAYS;
            invite.setExpiresAt(LocalDateTime.now().plusDays(expiresInDays));
            try {
                vipInviteCodeMapper.insert(invite);
                membershipAuditService.record(
                        adminUserId, "CREATE_VIP_INVITE", null, null,
                        invite.getId(), null,
                        invite.getRemark().isBlank() ? "创建知识星球 VIP 邀请码" : invite.getRemark(),
                        "创建邀请码 " + invite.getCode()
                                + "，名额 " + invite.getMaxRedemptions()
                                + "，权益 " + membershipDays + " 天"
                                + "，有效期 " + expiresInDays + " 天"
                );
                return toAdminDto(invite);
            } catch (DuplicateKeyException ignored) {
                // Retry with a fresh cryptographically random code.
            }
        }
        throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "生成邀请码失败");
    }

    @Override
    public List<VipInviteAdminDTO> listInvites() {
        return vipInviteCodeMapper.selectList(
                new LambdaQueryWrapper<VipInviteCode>()
                        .orderByDesc(VipInviteCode::getCreatedAt)
                        .orderByDesc(VipInviteCode::getId)
        ).stream().map(this::toAdminDto).toList();
    }

    @Override
    @Transactional
    public VipInviteAdminDTO invalidate(Long inviteId, Long adminUserId, String reason) {
        VipInviteCode invite = vipInviteCodeMapper.selectByIdForUpdate(inviteId);
        if (invite == null) {
            throw new BusinessException(ResultCode.VIP_INVITE_NOT_FOUND);
        }
        if ("INVALID".equals(invite.getInviteStatus())) {
            throw new BusinessException(ResultCode.VIP_INVITE_INVALID);
        }
        invite.setInviteStatus("INVALID");
        invite.setInvalidatedBy(adminUserId);
        invite.setInvalidatedAt(LocalDateTime.now());
        invite.setInvalidateReason(normalizeReason(reason));
        vipInviteCodeMapper.updateById(invite);
        membershipAuditService.record(
                adminUserId, "INVALIDATE_VIP_INVITE", null, null,
                inviteId, null, reason, "作废邀请码 " + invite.getCode() + "，不影响已兑换权益"
        );
        return toAdminDto(invite);
    }

    @Override
    public List<VipInviteRedemptionAdminDTO> listRedemptions(Long inviteId) {
        if (vipInviteCodeMapper.selectById(inviteId) == null) {
            throw new BusinessException(ResultCode.VIP_INVITE_NOT_FOUND);
        }
        return vipInviteRedemptionMapper.selectList(
                new LambdaQueryWrapper<VipInviteRedemption>()
                        .eq(VipInviteRedemption::getInviteCodeId, inviteId)
                        .orderByDesc(VipInviteRedemption::getRedeemedAt)
                        .orderByDesc(VipInviteRedemption::getId)
        ).stream().map(this::toRedemptionAdminDto).toList();
    }

    @Override
    @Transactional
    public VipInviteRedemptionAdminDTO revokeRedemption(
            Long inviteId,
            Long redemptionId,
            Long adminUserId,
            String reason
    ) {
        VipInviteRedemption redemption = vipInviteRedemptionMapper.selectByIdForUpdate(inviteId, redemptionId);
        if (redemption == null) {
            throw new BusinessException(ResultCode.VIP_INVITE_REDEMPTION_NOT_FOUND);
        }
        if ("REVOKED".equals(redemption.getRedemptionStatus())) {
            throw new BusinessException(ResultCode.VIP_INVITE_REDEMPTION_ALREADY_REVOKED);
        }

        User user = userMapper.selectByIdForUpdate(redemption.getUserId());
        User before = user == null ? null : membershipSnapshot(user);
        boolean membershipRevoked = user != null
                && "VIP_INVITE".equals(user.getMembershipOriginType())
                && redemption.getId().equals(user.getMembershipOriginId());
        if (membershipRevoked) {
            user.setMembershipStatus("FREE");
            user.setMembershipGrantedAt(null);
            user.setMembershipSource("ADMIN_REVOKED");
            user.setMembershipOriginType(null);
            user.setMembershipOriginId(null);
            user.setMembershipExpiresAt(null);
            userMapper.updateMembership(user);
        }

        LocalDateTime now = LocalDateTime.now();
        redemption.setRedemptionStatus("REVOKED");
        redemption.setRevokedBy(adminUserId);
        redemption.setRevokedAt(now);
        redemption.setRevokeReason(normalizeReason(reason));
        vipInviteRedemptionMapper.updateById(redemption);
        membershipAuditService.record(
                adminUserId, "REVOKE_VIP_INVITE_REDEMPTION", before, user,
                inviteId, redemptionId, reason,
                membershipRevoked ? "已撤销该兑换对应的当前 VIP 权益" : "兑换已标记撤销，当前会员权益来自其他途径，未撤销当前权益"
        );
        return toRedemptionAdminDto(redemption);
    }

    @Override
    @Transactional
    public VipInviteRedemptionDTO redeem(Long userId, String code, String clientIp) {
        User user = userMapper.selectByIdForUpdate(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        vipInviteRateLimitService.acquireAttempt("user:" + userId, clientIp);
        validateUserForRedemption(user);

        VipInviteCode invite = vipInviteCodeMapper.selectByCodeForUpdate(normalizeCode(code));
        validateForRedemption(invite);
        return grantInviteMembership(user, invite);
    }

    @Override
    @Transactional(
            propagation = Propagation.MANDATORY,
            noRollbackFor = BusinessException.class
    )
    public VipInviteRedemptionDTO redeemClaim(Long userId, Long inviteCodeId) {
        User user = userMapper.selectByIdForUpdate(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        validateUserForRedemption(user);

        VipInviteCode invite = vipInviteCodeMapper.selectByIdForUpdate(inviteCodeId);
        validateForRedemption(invite);
        return grantInviteMembership(user, invite);
    }

    private void validateUserForRedemption(User user) {
        if (hasActiveMembership(user)) {
            throw new BusinessException(ResultCode.MEMBERSHIP_ALREADY_ACTIVE);
        }
        Long previousRedemptions = vipInviteRedemptionMapper.selectCount(
                new LambdaQueryWrapper<VipInviteRedemption>()
                        .eq(VipInviteRedemption::getUserId, user.getId())
        );
        if (previousRedemptions != null && previousRedemptions > 0) {
            throw new BusinessException(ResultCode.VIP_INVITE_USER_ALREADY_REDEEMED);
        }
    }

    private VipInviteRedemptionDTO grantInviteMembership(User user, VipInviteCode invite) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime membershipExpiresAt = now.plusDays(invite.getMembershipDays());
        VipInviteRedemption redemption = new VipInviteRedemption();
        redemption.setInviteCodeId(invite.getId());
        redemption.setUserId(user.getId());
        redemption.setMembershipStartedAt(now);
        redemption.setMembershipExpiresAt(membershipExpiresAt);
        redemption.setRedemptionStatus("ACTIVE");
        redemption.setRedeemedAt(now);
        requireAffected(
                vipInviteRedemptionMapper.insert(redemption),
                "VIP invite redemption insert was lost"
        );

        user.setMembershipStatus("ACTIVE");
        user.setMembershipGrantedAt(now);
        user.setMembershipSource("VIP_INVITE");
        user.setMembershipOriginType("VIP_INVITE");
        user.setMembershipOriginId(redemption.getId());
        user.setMembershipExpiresAt(membershipExpiresAt);
        requireAffected(
                userMapper.updateMembership(user),
                "VIP invite membership update was lost"
        );

        int redeemedCount = invite.getRedeemedCount() + 1;
        invite.setRedeemedCount(redeemedCount);
        if (redeemedCount >= invite.getMaxRedemptions()) {
            invite.setInviteStatus("EXHAUSTED");
        }
        requireAffected(
                vipInviteCodeMapper.updateById(invite),
                "VIP invite quota update was lost"
        );

        return new VipInviteRedemptionDTO(
                "ACTIVE",
                DateTimeUtils.format(now),
                DateTimeUtils.format(membershipExpiresAt),
                "VIP_INVITE"
        );
    }

    private void requireAffected(int affected, String message) {
        if (affected != 1) {
            throw new IllegalStateException(message);
        }
    }

    private void validateForRedemption(VipInviteCode invite) {
        if (invite == null) {
            throw new BusinessException(ResultCode.VIP_INVITE_NOT_FOUND);
        }
        if ("EXHAUSTED".equals(invite.getInviteStatus())) {
            throw new BusinessException(ResultCode.VIP_INVITE_EXHAUSTED);
        }
        if (!"ACTIVE".equals(invite.getInviteStatus())) {
            throw new BusinessException(ResultCode.VIP_INVITE_INVALID);
        }
        if (invite.getExpiresAt() != null && !invite.getExpiresAt().isAfter(LocalDateTime.now())) {
            throw new BusinessException(ResultCode.VIP_INVITE_EXPIRED);
        }
        if (invite.getRedeemedCount() == null || invite.getMaxRedemptions() == null
                || invite.getRedeemedCount() >= invite.getMaxRedemptions()) {
            throw new BusinessException(ResultCode.VIP_INVITE_EXHAUSTED);
        }
    }

    private boolean hasActiveMembership(User user) {
        return "ACTIVE".equals(user.getMembershipStatus())
                && (user.getMembershipExpiresAt() == null
                || user.getMembershipExpiresAt().isAfter(LocalDateTime.now()));
    }

    private VipInviteAdminDTO toAdminDto(VipInviteCode invite) {
        VipInviteAdminDTO dto = new VipInviteAdminDTO();
        dto.setId(invite.getId());
        dto.setCode(invite.getCode());
        dto.setStatus(effectiveStatus(invite));
        dto.setRemark(invite.getRemark());
        dto.setCreatedBy(invite.getCreatedBy());
        dto.setMaxRedemptions(invite.getMaxRedemptions());
        dto.setRedeemedCount(invite.getRedeemedCount());
        dto.setMembershipDays(invite.getMembershipDays());
        dto.setExpiresAt(DateTimeUtils.format(invite.getExpiresAt()));
        dto.setInvalidatedBy(invite.getInvalidatedBy());
        dto.setInvalidatedAt(DateTimeUtils.format(invite.getInvalidatedAt()));
        dto.setInvalidateReason(invite.getInvalidateReason());
        dto.setCreatedAt(DateTimeUtils.format(invite.getCreatedAt()));
        return dto;
    }

    private VipInviteRedemptionAdminDTO toRedemptionAdminDto(VipInviteRedemption redemption) {
        VipInviteRedemptionAdminDTO dto = new VipInviteRedemptionAdminDTO();
        dto.setId(redemption.getId());
        dto.setInviteCodeId(redemption.getInviteCodeId());
        dto.setUserId(redemption.getUserId());
        User user = userMapper.selectById(redemption.getUserId());
        dto.setUserEmail(user == null ? "" : user.getEmail());
        dto.setMembershipStartedAt(DateTimeUtils.format(redemption.getMembershipStartedAt()));
        dto.setMembershipExpiresAt(DateTimeUtils.format(redemption.getMembershipExpiresAt()));
        dto.setRedemptionStatus(redemption.getRedemptionStatus());
        dto.setRevokedBy(redemption.getRevokedBy());
        dto.setRevokedAt(DateTimeUtils.format(redemption.getRevokedAt()));
        dto.setRevokeReason(redemption.getRevokeReason());
        dto.setRedeemedAt(DateTimeUtils.format(redemption.getRedeemedAt()));
        return dto;
    }

    private String buildCode() {
        StringBuilder builder = new StringBuilder("VIP");
        for (int index = 0; index < 10; index += 1) {
            builder.append(CODE_CHARACTERS.charAt(RANDOM.nextInt(CODE_CHARACTERS.length())));
        }
        return builder.toString();
    }

    private String normalizeCode(String code) {
        return code == null ? "" : code.trim().toUpperCase();
    }

    private String normalizeRemark(String remark) {
        return remark == null ? "" : remark.trim();
    }

    private String normalizeReason(String reason) {
        return reason == null ? "" : reason.trim();
    }

    private String effectiveStatus(VipInviteCode invite) {
        if ("ACTIVE".equals(invite.getInviteStatus())
                && invite.getExpiresAt() != null
                && !invite.getExpiresAt().isAfter(LocalDateTime.now())) {
            return "EXPIRED";
        }
        return invite.getInviteStatus();
    }

    private User membershipSnapshot(User user) {
        User snapshot = new User();
        snapshot.setId(user.getId());
        snapshot.setMembershipStatus(user.getMembershipStatus());
        snapshot.setMembershipGrantedAt(user.getMembershipGrantedAt());
        snapshot.setMembershipSource(user.getMembershipSource());
        snapshot.setMembershipOriginType(user.getMembershipOriginType());
        snapshot.setMembershipOriginId(user.getMembershipOriginId());
        snapshot.setMembershipExpiresAt(user.getMembershipExpiresAt());
        return snapshot;
    }
}
