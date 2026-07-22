package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.MembershipAdminAuditLogDTO;
import com.itwanger.pairesume.entity.User;

import java.util.List;

public interface MembershipAuditService {
    void record(
            Long adminUserId,
            String action,
            User beforeUser,
            User afterUser,
            Long inviteCodeId,
            Long redemptionId,
            String reason,
            String details
    );

    List<MembershipAdminAuditLogDTO> listRecent();
}
