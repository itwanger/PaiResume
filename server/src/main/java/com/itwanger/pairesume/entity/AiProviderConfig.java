package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("ai_provider_config")
public class AiProviderConfig {
    public static final long SINGLE_ROW_ID = 1L;

    @TableId(type = IdType.INPUT)
    private Long id;
    private String providerCode;
    private String displayName;
    private String baseUrl;
    private String generalModel;
    private String analysisModel;
    private byte[] apiKeyCipher;
    private String apiKeyMask;
    private String privacyPolicyUrl;
    private Boolean enabled;
    private Long updatedBy;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
