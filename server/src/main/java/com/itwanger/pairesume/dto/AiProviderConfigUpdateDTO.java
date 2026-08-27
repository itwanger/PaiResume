package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AiProviderConfigUpdateDTO {
    @NotBlank(message = "AI 服务商不能为空")
    @Size(max = 32, message = "AI 服务商编码不能超过 32 个字符")
    private String providerCode;

    @NotBlank(message = "模型不能为空")
    @Size(max = 64, message = "模型编码不能超过 64 个字符")
    private String modelId;

    /** 留空表示保留已配置的 API Key，非空才轮换。 */
    @Size(max = 512, message = "API Key 不能超过 512 个字符")
    private String apiKey;

    private boolean autoUpgrade;

    private boolean enabled;
}
