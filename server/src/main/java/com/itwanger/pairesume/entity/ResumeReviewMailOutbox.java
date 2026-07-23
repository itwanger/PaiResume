package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("resume_review_mail_outbox")
public class ResumeReviewMailOutbox {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long requestId;
    private String messageId;
    private String outboxStatus;
    private Integer attemptCount;
    private LocalDateTime nextAttemptAt;
    private String lastErrorType;
    private LocalDateTime sentAt;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
