package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("marketplace_governance_audit")
public class MarketplaceGovernanceAudit {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long listingId;
    private Long actorUserId;
    private String actorType;
    private String action;
    private String targetType;
    private Long targetId;
    private String fromStatus;
    private String toStatus;
    private String reason;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
