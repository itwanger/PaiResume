package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class MarketplaceAppealRequestDTO {
    @NotBlank(message = "申诉说明不能为空")
    @Size(min = 10, max = 1000, message = "申诉说明长度应为 10 到 1000 个字符")
    private String description;
}
