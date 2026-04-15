package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PlatformConfigDTO {
    @NotNull(message = "会员价格不能为空")
    @Min(value = 0, message = "会员价格不能小于 0")
    private Integer membershipPriceCents;

    @NotNull(message = "问卷优惠金额不能为空")
    @Min(value = 0, message = "问卷优惠金额不能小于 0")
    private Integer questionnaireCouponAmountCents;
}
