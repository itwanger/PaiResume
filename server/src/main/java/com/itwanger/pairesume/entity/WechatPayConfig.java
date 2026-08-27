package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("wechat_pay_config")
public class WechatPayConfig {
    public static final long SINGLE_ROW_ID = 1L;

    @TableId(type = IdType.INPUT)
    private Long id;
    private String appId;
    private String merchantId;
    private byte[] privateKeyCipher;
    private String privateKeyMask;
    private String merchantSerialNumber;
    private byte[] apiV3KeyCipher;
    private String apiV3KeyMask;
    private String paymentNotifyUrl;
    private String refundNotifyUrl;
    private Boolean enabled;
    private Long updatedBy;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
