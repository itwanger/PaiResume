package com.itwanger.pairesume.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class ResumeImportDTO {
    @NotBlank(message = "请输入简历名称")
    @Size(max = 128, message = "简历标题不能超过 128 个字符")
    private String title;

    @Size(max = 64, message = "模板标识不能超过 64 个字符")
    private String templateId;

    @Valid
    @NotEmpty(message = "导入简历至少需要一个模块")
    @Size(max = 100, message = "单次导入不能超过 100 个模块")
    private List<ResumeImportModuleDTO> modules;
}
