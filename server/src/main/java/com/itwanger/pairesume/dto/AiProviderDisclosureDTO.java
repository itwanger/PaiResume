package com.itwanger.pairesume.dto;

import lombok.Data;

/**
 * 用户端第三方 AI 处理披露信息：服务商名称与隐私政策链接。
 */
@Data
public class AiProviderDisclosureDTO {
    private String aiProviderName;
    private String aiProviderPrivacyUrl;
}
