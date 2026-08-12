package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ContentTemplateCreateResumeDTO {
    @NotBlank(message = "请输入简历名称")
    @Size(max = 128)
    private String title;
}
