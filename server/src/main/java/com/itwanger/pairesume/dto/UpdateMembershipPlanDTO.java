package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateMembershipPlanDTO {
    @Min(value = 1, message = "会员方案价格必须大于 0")
    private Integer priceCents;
    @NotNull(message = "会员方案启用状态不能为空")
    private Boolean enabled;
}
