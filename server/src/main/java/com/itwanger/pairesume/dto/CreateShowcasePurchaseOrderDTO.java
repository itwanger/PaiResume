package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateShowcasePurchaseOrderDTO {
    @NotBlank(message = "缺少幂等键")
    @Size(max = 64, message = "幂等键过长")
    @Pattern(regexp = "[A-Za-z0-9_-]+", message = "幂等键格式不正确")
    private String idempotencyKey;
}
