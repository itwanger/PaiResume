package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ConfirmMarketplaceRefundDTO {
    @NotBlank(message = "请填写商户平台退款单号或核验流水")
    @Size(max = 128, message = "退款核验流水不能超过 128 个字符")
    private String refundReference;

    @NotBlank(message = "请填写退款备注")
    @Size(max = 255, message = "退款备注不能超过 255 个字符")
    private String note;
}
