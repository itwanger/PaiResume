package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ResumeShowcaseFeatureDTO {
    @NotBlank(message = "请选择查看方式")
    private String accessType;
}
