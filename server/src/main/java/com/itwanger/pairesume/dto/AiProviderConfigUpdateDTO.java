package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AiProviderConfigUpdateDTO {
    @NotBlank(message = "服务商名称不能为空")
    @Size(max = 64, message = "服务商名称不能超过 64 个字符")
    private String displayName;

    @NotBlank(message = "Base URL 不能为空")
    @Size(max = 255, message = "Base URL 不能超过 255 个字符")
    private String baseUrl;

    @NotBlank(message = "通用模型不能为空")
    @Size(max = 64, message = "通用模型不能超过 64 个字符")
    private String generalModel;

    @NotBlank(message = "分析模型不能为空")
    @Size(max = 64, message = "分析模型不能超过 64 个字符")
    private String analysisModel;

    /** 留空表示保留已配置的 API Key，非空才轮换。 */
    @Size(max = 512, message = "API Key 不能超过 512 个字符")
    private String apiKey;

    @Size(max = 255, message = "隐私政策链接不能超过 255 个字符")
    private String privacyPolicyUrl;

    private boolean enabled;
}
