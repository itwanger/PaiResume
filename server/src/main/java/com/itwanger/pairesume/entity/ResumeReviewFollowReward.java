package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("resume_review_follow_reward")
public class ResumeReviewFollowReward {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String quotaSubjectHash;
    private String sourceType;
    private String sourceReferenceHash;
    private Long consumedRequestId;
    private LocalDateTime issuedAt;
    private LocalDateTime consumedAt;
}
