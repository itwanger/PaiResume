package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("resume_photo_oss_config_audit")
public class ResumePhotoOssConfigAudit {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long adminUserId;
    private String action;
    private String changedFields;
    private Boolean credentialsRotated;
    private String detail;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
