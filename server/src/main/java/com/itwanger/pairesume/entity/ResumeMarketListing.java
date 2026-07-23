package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName(value = "resume_market_listing", autoResultMap = true)
public class ResumeMarketListing {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long resumeId;

    private Long sellerUserId;

    private String slug;

    private String summary;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> tags;

    private String accessType;

    private Integer priceCents;

    private Long viewCount;

    private String publicationStatus;

    private String moderationStatus;

    private String reviewStatus;

    private LocalDateTime reviewSubmittedAt;

    private Boolean publishAfterReview;

    private Long moderatedBy;

    private LocalDateTime moderatedAt;

    private String moderationReason;

    private Long currentRevisionId;

    private Long pendingRevisionId;

    private LocalDateTime publicConsentAt;

    private LocalDateTime publishedAt;

    private Integer version;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
