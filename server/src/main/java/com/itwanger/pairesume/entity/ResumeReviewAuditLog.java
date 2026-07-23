package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("resume_review_audit_log")
public class ResumeReviewAuditLog {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long requestId;
    private String requestNo;
    private Long actorUserId;
    private String actorType;
    private String action;
    private String fromStatus;
    private String toStatus;
    private String reason;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
