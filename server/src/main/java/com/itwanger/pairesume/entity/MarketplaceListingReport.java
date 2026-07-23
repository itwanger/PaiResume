package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("marketplace_listing_report")
public class MarketplaceListingReport {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long listingId;
    private String reportType;
    private String description;
    private String contact;
    private String reporterIpHash;
    private String fingerprint;
    private String processingStatus;
    private Long handledBy;
    private String handledReason;
    private LocalDateTime handledAt;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
