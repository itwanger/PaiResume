package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AdminMarketplaceActionDTO {
    @NotBlank(message = "处理动作不能为空")
    private String action;

    @NotBlank(message = "处理原因不能为空")
    @Size(max = 500, message = "处理原因不能超过 500 个字符")
    private String reason;
}
