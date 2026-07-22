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
@TableName("resume_view_entitlement")
public class ResumeViewEntitlement {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long listingId;
    private Long listingRevisionId;
    private Long buyerUserId;
    private Long sourceOrderId;
    private String entitlementStatus;
    private LocalDateTime grantedAt;
    /** A legitimate repurchase reactivates the unique entitlement row and clears refund metadata. */
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private LocalDateTime revokedAt;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String revokeReason;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
