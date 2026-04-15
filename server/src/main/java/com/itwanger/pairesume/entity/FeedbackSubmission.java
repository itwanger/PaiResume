package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("feedback_submission")
public class FeedbackSubmission {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String contactEmail;

    private String displayName;

    private String schoolOrCompany;

    private String targetRole;

    private Integer rating;

    private String testimonialText;

    private String desiredFeatures;

    private String bugFeedback;

    private Integer consentToPublish;

    private String reviewStatus;

    private String publishStatus;

    private String couponStatus;

    private String reviewNote;

    private Long reviewedBy;

    private LocalDateTime reviewedAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
