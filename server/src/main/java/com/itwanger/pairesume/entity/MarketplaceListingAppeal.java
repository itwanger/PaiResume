package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("marketplace_listing_appeal")
public class MarketplaceListingAppeal {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long listingId;
    private Long listingRevisionId;
    private Long creatorUserId;
    private String appealType;
    private String description;
    private String appealStatus;
    private Long handledBy;
    private String handledReason;
    private LocalDateTime handledAt;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
