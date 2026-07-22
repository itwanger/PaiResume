package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("creator_earning")
public class CreatorEarning {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long sellerUserId;
    private Long listingId;
    private Long orderId;
    private Integer grossAmountCents;
    private Integer platformFeeCents;
    private Integer netAmountCents;
    private Integer walletCreditCents;
    private Integer debtOffsetCents;
    private String earningStatus;
    private LocalDateTime availableAt;
    private LocalDateTime reversedAt;
    private String reversedFromStatus;
    private String reversalReason;
    private Long settledBy;
    private LocalDateTime settledAt;
    private String settlementNote;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
