package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("membership_admin_audit_log")
public class MembershipAdminAuditLog {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long adminUserId;
    private String action;
    private Long targetUserId;
    private Long inviteCodeId;
    private Long redemptionId;
    private String reason;
    private String beforeMembershipStatus;
    private String beforeMembershipSource;
    private LocalDateTime beforeMembershipExpiresAt;
    private String afterMembershipStatus;
    private String afterMembershipSource;
    private LocalDateTime afterMembershipExpiresAt;
    private String details;
    private LocalDateTime createdAt;
}
