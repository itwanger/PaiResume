package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class MarketListingUpsertDTO {
    @NotBlank(message = "请选择公开方式")
    private String accessType;

    @NotNull(message = "价格不能为空")
    private Integer priceCents;

    @NotBlank(message = "公开摘要不能为空")
    @Size(max = 512, message = "公开摘要不能超过 512 个字符")
    private String summary;

    @Size(max = 8, message = "最多设置 8 个标签")
    private List<String> tags;

    private Boolean privacyConfirmed;
}
