package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class OfficialMaterialUpsertDTO {
    @NotBlank(message = "请选择素材类型")
    @Size(max = 32)
    private String moduleType;
    @NotBlank(message = "请输入素材标题")
    @Size(max = 128)
    private String title;
    @Size(max = 128)
    private String targetRole;
    @Size(max = 64)
    private String careerStage;
    @NotNull(message = "素材内容不能为空")
    private Map<String, Object> content;
    @Size(max = 20)
    private List<@Size(max = 32) String> tags;
    @NotBlank(message = "请选择发布状态")
    private String status;
    private String sourceType;
}
