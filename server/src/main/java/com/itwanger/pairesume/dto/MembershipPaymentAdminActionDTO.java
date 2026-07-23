package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class MembershipPaymentAdminActionDTO {
    @NotBlank(message = "请填写操作原因")
    @Size(max = 255, message = "操作原因不能超过 255 个字符")
    private String reason;

    @Size(max = 128, message = "退款流水不能超过 128 个字符")
    private String refundReference;
}
