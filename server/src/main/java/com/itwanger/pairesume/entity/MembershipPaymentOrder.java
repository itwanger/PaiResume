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
@TableName("membership_payment_order")
public class MembershipPaymentOrder {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String orderNo;
    private Long userId;
    private String idempotencyKey;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String activeOrderKey;
    private Long couponCodeId;
    private String couponCodeSnapshot;
    private Integer membershipDays;
    private Integer listPriceCents;
    private Integer discountAmountCents;
    private Integer payableAmountCents;
    private String currency;
    private String provider;
    private String payChannel;
    private String orderStatus;
    private String providerPrepayId;
    private String codeUrl;
    private String providerTransactionId;
    private LocalDateTime expiresAt;
    private LocalDateTime lastCheckedAt;
    private LocalDateTime paidAt;
    private LocalDateTime closedAt;
    private LocalDateTime membershipStartedAt;
    private LocalDateTime membershipExpiresAt;
    private String paymentReviewReason;
    private String reviewStatus;
    private String lastAdminAction;
    private String adminActionReason;
    private Long handledBy;
    private String refundReference;
    private LocalDateTime reviewStartedAt;
    private LocalDateTime reviewResolvedAt;
    private LocalDateTime reviewUpdatedAt;
    private String reconcileLeaseToken;
    private LocalDateTime reconcileLeaseUntil;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
