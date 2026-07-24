package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("resume_review_upload")
public class ResumeReviewUpload {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String uploadNo;
    private Long userId;
    private Long resumeId;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String activeUserKey;
    private String stagingObjectKey;
    private String finalObjectKey;
    private String originalFileName;
    private Long sizeBytes;
    private String sha256;
    private String objectEtag;
    private String uploadStatus;
    private LocalDateTime expiresAt;
    private Long consumedRequestId;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
