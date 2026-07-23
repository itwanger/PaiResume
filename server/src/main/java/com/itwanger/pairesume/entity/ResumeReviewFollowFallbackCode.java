package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("resume_review_follow_fallback_code")
public class ResumeReviewFollowFallbackCode {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String codeHash;
    private String codeHint;
    private String codeStatus;
    private Long createdBy;
    private Long redeemedBy;
    private LocalDateTime expiresAt;
    private LocalDateTime redeemedAt;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
