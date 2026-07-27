package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResumeUpdateDTO {
    @NotBlank(message = "简历标题不能为空")
    @Size(max = 128, message = "简历名称不能超过 128 个字符")
    private String title;
}
