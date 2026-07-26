package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Map;

@Data
public class ResumeImportModuleDTO {
    @NotBlank(message = "模块类型不能为空")
    @Size(max = 32, message = "模块类型不能超过 32 个字符")
    private String moduleType;

    @NotNull(message = "模块内容不能为空")
    private Map<String, Object> content;

    @Min(value = 0, message = "模块排序不能小于 0")
    private Integer sortOrder;
}
