package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ExtendMembershipDTO {
    @NotNull(message = "延期天数不能为空")
    @Min(value = 1, message = "延期天数不能少于1天")
    @Max(value = 3650, message = "延期天数不能超过3650天")
    private Integer days;

    @NotBlank(message = "延期原因不能为空")
    @Size(max = 255, message = "延期原因不能超过255个字符")
    private String reason;
}
