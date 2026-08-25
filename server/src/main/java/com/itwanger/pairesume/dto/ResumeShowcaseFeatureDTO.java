package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ResumeShowcaseFeatureDTO {
    @NotBlank(message = "请选择查看方式")
    private String accessType;

    @NotNull(message = "请设置价格")
    private Integer priceCents;
}
