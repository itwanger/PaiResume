package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class MembershipQuoteRequestDTO {
    @Size(max = 32, message = "会员方案编码不能超过 32 个字符")
    @Pattern(regexp = "^[A-Za-z_]*$", message = "会员方案编码格式不合法")
    private String planCode;

    @Size(max = 64, message = "优惠码长度不能超过 64 个字符")
    @Pattern(regexp = "^[A-Za-z0-9]*$", message = "优惠码格式不合法")
    private String couponCode;
}
