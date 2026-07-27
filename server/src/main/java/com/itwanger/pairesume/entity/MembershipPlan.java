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
@TableName("membership_plan")
public class MembershipPlan {
    @TableId(type = IdType.INPUT)
    private String planCode;
    private String displayName;
    private String entitlementType;
    private Integer membershipDays;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private Integer priceCents;
    private Boolean enabled;
    private Boolean recommended;
    private Integer sortOrder;
    private Long updatedBy;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
