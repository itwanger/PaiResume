package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.dto.MembershipAdminAuditLogDTO;
import com.itwanger.pairesume.entity.MembershipAdminAuditLog;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.MembershipAdminAuditLogMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.service.MembershipAuditService;
import com.itwanger.pairesume.util.DateTimeUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MembershipAuditServiceImpl implements MembershipAuditService {
    private final MembershipAdminAuditLogMapper auditLogMapper;
    private final UserMapper userMapper;

    @Override
    public void record(
            Long adminUserId,
            String action,
            User beforeUser,
            User afterUser,
            Long inviteCodeId,
            Long redemptionId,
            String reason,
            String details
    ) {
        MembershipAdminAuditLog log = new MembershipAdminAuditLog();
        log.setAdminUserId(adminUserId);
        log.setAction(action);
        log.setTargetUserId(afterUser != null ? afterUser.getId() : beforeUser == null ? null : beforeUser.getId());
        log.setInviteCodeId(inviteCodeId);
        log.setRedemptionId(redemptionId);
        log.setReason(reason == null ? "" : reason.trim());
        if (beforeUser != null) {
            log.setBeforeMembershipStatus(beforeUser.getMembershipStatus());
            log.setBeforeMembershipSource(beforeUser.getMembershipSource());
            log.setBeforeMembershipExpiresAt(beforeUser.getMembershipExpiresAt());
        }
        if (afterUser != null) {
            log.setAfterMembershipStatus(afterUser.getMembershipStatus());
            log.setAfterMembershipSource(afterUser.getMembershipSource());
            log.setAfterMembershipExpiresAt(afterUser.getMembershipExpiresAt());
        }
        log.setDetails(details);
        auditLogMapper.insert(log);
    }

    @Override
    public List<MembershipAdminAuditLogDTO> listRecent() {
        return auditLogMapper.selectList(
                new LambdaQueryWrapper<MembershipAdminAuditLog>()
                        .orderByDesc(MembershipAdminAuditLog::getCreatedAt)
                        .orderByDesc(MembershipAdminAuditLog::getId)
                        .last("LIMIT 200")
        ).stream().map(this::toDto).toList();
    }

    private MembershipAdminAuditLogDTO toDto(MembershipAdminAuditLog log) {
        MembershipAdminAuditLogDTO dto = new MembershipAdminAuditLogDTO();
        dto.setId(log.getId());
        dto.setAdminUserId(log.getAdminUserId());
        dto.setAdminEmail(emailOf(log.getAdminUserId()));
        dto.setAction(log.getAction());
        dto.setTargetUserId(log.getTargetUserId());
        dto.setTargetUserEmail(emailOf(log.getTargetUserId()));
        dto.setInviteCodeId(log.getInviteCodeId());
        dto.setRedemptionId(log.getRedemptionId());
        dto.setReason(log.getReason());
        dto.setBeforeMembershipStatus(log.getBeforeMembershipStatus());
        dto.setBeforeMembershipSource(log.getBeforeMembershipSource());
        dto.setBeforeMembershipExpiresAt(DateTimeUtils.format(log.getBeforeMembershipExpiresAt()));
        dto.setAfterMembershipStatus(log.getAfterMembershipStatus());
        dto.setAfterMembershipSource(log.getAfterMembershipSource());
        dto.setAfterMembershipExpiresAt(DateTimeUtils.format(log.getAfterMembershipExpiresAt()));
        dto.setDetails(log.getDetails());
        dto.setCreatedAt(DateTimeUtils.format(log.getCreatedAt()));
        return dto;
    }

    private String emailOf(Long userId) {
        if (userId == null) {
            return "";
        }
        User user = userMapper.selectById(userId);
        return user == null ? "" : user.getEmail();
    }
}
