package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AdminMarketModerationDTO {
    @NotBlank(message = "审核动作不能为空")
    private String action;

    @NotBlank(message = "审核原因不能为空")
    @Size(max = 255, message = "审核原因不能超过 255 个字符")
    private String reason;
}
