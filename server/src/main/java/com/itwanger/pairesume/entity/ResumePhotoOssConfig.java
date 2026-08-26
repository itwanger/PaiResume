package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("resume_photo_oss_config")
public class ResumePhotoOssConfig {
    public static final long SINGLE_ROW_ID = 1L;

    @TableId(type = IdType.INPUT)
    private Long id;
    private String endpoint;
    private String bucket;
    private String objectPrefix;
    private byte[] accessKeyIdCipher;
    private String accessKeyIdMask;
    private byte[] accessKeySecretCipher;
    private String accessKeySecretMask;
    private Boolean privateBucketConfirmed;
    private Boolean corsConfirmed;
    private Boolean stagingLifecycleConfirmed;
    private Boolean ramPolicyConfirmed;
    private Boolean enabled;
    private Long updatedBy;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
