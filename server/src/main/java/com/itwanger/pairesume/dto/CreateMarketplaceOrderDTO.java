package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateMarketplaceOrderDTO {
    @NotBlank(message = "幂等键不能为空")
    @Size(min = 8, max = 64, message = "幂等键长度应为 8-64 个字符")
    @Pattern(regexp = "^[A-Za-z0-9._:-]+$", message = "幂等键格式不合法")
    private String idempotencyKey;
}
