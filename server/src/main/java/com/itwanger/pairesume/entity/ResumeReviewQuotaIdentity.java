package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("resume_review_quota_identity")
public class ResumeReviewQuotaIdentity {
    @TableId(type = IdType.INPUT)
    private String identityHash;
    private String quotaSubjectHash;
    private Long firstUserId;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
