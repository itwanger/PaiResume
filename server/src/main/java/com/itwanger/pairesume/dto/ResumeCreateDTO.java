package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResumeCreateDTO {
    @NotBlank(message = "请输入简历名称")
    @Size(max = 128, message = "简历名称不能超过 128 个字符")
    private String title;

    @Size(max = 64, message = "模板标识不能超过 64 个字符")
    private String templateId;
}
