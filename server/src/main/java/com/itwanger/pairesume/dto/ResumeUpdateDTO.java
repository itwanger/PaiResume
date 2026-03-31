package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ResumeUpdateDTO {
    @NotBlank(message = "简历标题不能为空")
    private String title;
}
