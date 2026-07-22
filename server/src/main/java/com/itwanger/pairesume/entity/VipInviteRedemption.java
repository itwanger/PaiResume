package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("vip_invite_redemption")
public class VipInviteRedemption {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long inviteCodeId;
    private Long userId;
    private LocalDateTime membershipStartedAt;
    private LocalDateTime membershipExpiresAt;
    private String redemptionStatus;
    private Long revokedBy;
    private LocalDateTime revokedAt;
    private String revokeReason;
    private LocalDateTime redeemedAt;
}
