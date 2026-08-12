package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("resume_photo")
public class ResumePhoto {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String photoNo;
    private Long userId;
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String activeUserKey;
    private String stagingObjectKey;
    private String objectKey;
    private String originalFileName;
    private String contentType;
    private Long sizeBytes;
    private String sha256;
    private Integer width;
    private Integer height;
    private String objectEtag;
    private String photoStatus;
    private LocalDateTime expiresAt;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
