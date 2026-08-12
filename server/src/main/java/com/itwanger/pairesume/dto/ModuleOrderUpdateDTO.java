package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class ModuleOrderUpdateDTO {
    @NotEmpty(message = "模块顺序不能为空")
    @Size(max = 100, message = "单份简历不能超过 100 个模块")
    private List<@NotNull(message = "模块标识不能为空") Long> moduleIds;
}
