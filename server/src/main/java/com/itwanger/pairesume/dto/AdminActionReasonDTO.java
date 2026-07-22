package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AdminActionReasonDTO {
    @NotBlank(message = "操作原因不能为空")
    @Size(max = 255, message = "操作原因不能超过255个字符")
    private String reason;
}
