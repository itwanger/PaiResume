package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("coupon_code")
public class CouponCode {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String code;

    private String sourceType;

    private Long sourceId;

    private String recipientEmail;

    private Integer amountCents;

    @TableField("status")
    private String couponStatus;

    private Long usedByUserId;

    private LocalDateTime usedAt;

    private LocalDateTime emailSentAt;

    private LocalDateTime expiresAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
