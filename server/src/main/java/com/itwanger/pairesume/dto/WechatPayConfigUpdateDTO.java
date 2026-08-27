package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class WechatPayConfigUpdateDTO {
    @Size(max = 64, message = "App ID 不能超过 64 个字符")
    private String appId;

    @Size(max = 32, message = "商户号不能超过 32 个字符")
    private String merchantId;

    /** 留空表示保留已加密的值，尚未入库时可从环境变量导入。 */
    @Size(max = 16384, message = "商户私钥内容过长")
    private String privateKey;

    @Size(max = 128, message = "商户证书序列号不能超过 128 个字符")
    private String merchantSerialNumber;

    /** 留空表示保留已加密的值，尚未入库时可从环境变量导入。 */
    @Size(max = 64, message = "API v3 Key 内容过长")
    private String apiV3Key;

    @Size(max = 255, message = "支付通知地址不能超过 255 个字符")
    private String paymentNotifyUrl;

    @Size(max = 255, message = "退款通知地址不能超过 255 个字符")
    private String refundNotifyUrl;

    private boolean enabled;
}
