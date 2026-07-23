package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("resume_review_credit_ledger")
public class ResumeReviewCreditLedger {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private Long requestId;
    private String creditType;
    private String ledgerStatus;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String activeEntitlementKey;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
