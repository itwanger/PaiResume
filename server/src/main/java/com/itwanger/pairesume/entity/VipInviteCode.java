package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("vip_invite_code")
public class VipInviteCode {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String code;

    @TableField("status")
    private String inviteStatus;

    private String remark;

    private Long createdBy;

    private Integer maxRedemptions;

    private Integer redeemedCount;

    private Integer membershipDays;

    private LocalDateTime expiresAt;

    private Long invalidatedBy;

    private LocalDateTime invalidatedAt;

    private String invalidateReason;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
