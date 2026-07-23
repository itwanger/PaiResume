package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("resume_review_follow_challenge")
public class ResumeReviewFollowChallenge {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String challengeCode;
    private Long userId;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String activeUserKey;
    private String challengeStatus;
    private LocalDateTime expiresAt;
    private LocalDateTime redeemedAt;
    private String bridgeEventHash;
    private String wechatOpenidHash;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
