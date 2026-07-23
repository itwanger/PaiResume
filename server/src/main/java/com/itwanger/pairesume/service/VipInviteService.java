package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.CreateVipInviteDTO;
import com.itwanger.pairesume.dto.VipInviteAdminDTO;
import com.itwanger.pairesume.dto.VipInviteRedemptionDTO;
import com.itwanger.pairesume.dto.VipInviteRedemptionAdminDTO;

import java.util.List;

public interface VipInviteService {
    VipInviteAdminDTO create(Long adminUserId, CreateVipInviteDTO dto);

    List<VipInviteAdminDTO> listInvites();

    VipInviteAdminDTO invalidate(Long inviteId, Long adminUserId, String reason);

    List<VipInviteRedemptionAdminDTO> listRedemptions(Long inviteId);

    VipInviteRedemptionAdminDTO revokeRedemption(
            Long inviteId,
            Long redemptionId,
            Long adminUserId,
            String reason
    );

    VipInviteRedemptionDTO redeem(Long userId, String code, String clientIp);

    /**
     * 在调用方已经开启的领取事务内，按已验证的邀请码主键兑换权益。
     * 该入口不接收邀请码明文，也不重复消耗匿名创建 claim 的限流预算。
     */
    VipInviteRedemptionDTO redeemClaim(Long userId, Long inviteCodeId);
}
