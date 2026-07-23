package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("vip_invite_claim")
public class VipInviteClaim {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tokenHash;
    private Long inviteCodeId;
    private String challengeIdHash;
    private Long userId;
    private Long redemptionId;

    @TableField("status")
    private String claimStatus;

    private String failureCode;
    private LocalDateTime expiresAt;
    private LocalDateTime boundAt;
    private LocalDateTime completedAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
