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
@TableName("resume_review_request")
public class ResumeReviewRequest {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String requestNo;
    private Long userId;
    private String quotaSubjectHash;
    private Long resumeId;
    private String idempotencyKey;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String activeUserKey;
    private String contactEmail;
    private String snapshotJson;
    private String contentHash;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String pdfObjectKey;
    private String pdfObjectEtag;
    private String pdfOriginalFileName;
    private Long pdfSizeBytes;
    private String pdfSha256;
    private LocalDateTime pdfUploadedAt;
    private String reviewConsentVersion;
    private LocalDateTime reviewConsentAt;
    private String emailConsentVersion;
    private LocalDateTime emailConsentAt;
    private String entitlementType;
    private String requestStatus;
    private Integer priceCents;
    private String orderNo;
    private String provider;
    private String payChannel;
    private String paymentStatus;
    private String providerPrepayId;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String codeUrl;
    private String providerTransactionId;
    private LocalDateTime paymentExpiresAt;
    private LocalDateTime paidAt;
    private String refundReason;
    private String refundReference;
    private Long handledBy;
    private LocalDateTime acceptedAt;
    private LocalDateTime completedAt;
    private LocalDateTime returnedAt;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
