package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class MarketplaceReportRequestDTO {
    @NotBlank(message = "举报类型不能为空")
    private String type;

    @NotBlank(message = "举报说明不能为空")
    @Size(min = 10, max = 1000, message = "举报说明长度应为 10 到 1000 个字符")
    private String description;

    @Size(max = 255, message = "联系方式不能超过 255 个字符")
    private String contact;
}
