package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("creator_wallet")
public class CreatorWallet {
    @TableId(type = IdType.INPUT)
    private Long userId;
    private Long heldBalanceCents;
    private Long pendingBalanceCents;
    private Long availableBalanceCents;
    private Long debtBalanceCents;
    private Long lifetimeEarnedCents;
    private Long lifetimeRefundedCents;
    private Long paidOutCents;
    private Integer version;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
