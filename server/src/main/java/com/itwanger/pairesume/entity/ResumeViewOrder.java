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
@TableName("resume_view_order")
public class ResumeViewOrder {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String orderNo;
    private Long buyerUserId;
    private Long sellerUserId;
    private Long listingId;
    private Long listingRevisionId;
    private String idempotencyKey;
    /** Terminal transitions must persist NULL to release the unique checkout reservation. */
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String activeOrderKey;
    private Integer amountCents;
    private Integer platformFeeCents;
    private Integer sellerIncomeCents;
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
    private LocalDateTime providerReconciledAt;
    private String reconcileLeaseToken;
    private LocalDateTime reconcileLeaseUntil;
    private LocalDateTime saleClosedAt;
    private String saleCloseReason;
    private String paymentReviewReason;
    private String refundReference;
    private String refundNote;
    private Long refundResolvedBy;
    private LocalDateTime refundResolvedAt;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
