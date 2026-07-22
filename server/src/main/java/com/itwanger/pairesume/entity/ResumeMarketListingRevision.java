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
import java.util.Map;

@Data
@TableName(value = "resume_market_listing_revision", autoResultMap = true)
public class ResumeMarketListingRevision {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long listingId;

    private Integer revisionNo;

    private String titleSnapshot;

    private String templateIdSnapshot;

    private String summarySnapshot;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> tagsSnapshot;

    private String accessTypeSnapshot;

    private Integer priceCentsSnapshot;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> modulesSnapshot;

    private LocalDateTime sourceResumeUpdatedAt;

    private String contentHash;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
