package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("showcase_purchase_order")
public class ShowcasePurchaseOrder {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String orderNo;
    private Long showcaseId;
    private String purchaseTokenHash;
    private String idempotencyKey;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String activeOrderKey;
    private Integer amountCents;
    private String currency;
    private String provider;
    private String payChannel;
    private String orderStatus;
    private String providerPrepayId;
    private String codeUrl;
    private String providerTransactionId;
    private LocalDateTime expiresAt;
    private LocalDateTime paidAt;
    private LocalDateTime closedAt;
    private LocalDateTime refundedAt;
    private LocalDateTime lastCheckedAt;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
