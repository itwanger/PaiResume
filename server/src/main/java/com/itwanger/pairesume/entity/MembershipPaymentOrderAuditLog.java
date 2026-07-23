package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("membership_payment_order_audit_log")
public class MembershipPaymentOrderAuditLog {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long orderId;
    private String orderNo;
    private Long adminUserId;
    private String action;
    private String fromStatus;
    private String toStatus;
    private String reason;
    private String refundReference;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
