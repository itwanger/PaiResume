package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class ContentTemplateUpsertDTO {
    @NotBlank(message = "请输入内容模板名称")
    @Size(max = 128)
    private String title;
    @Size(max = 512)
    private String summary;
    @Size(max = 128)
    private String targetRole;
    @Size(max = 64)
    private String careerStage;
    @Size(max = 64)
    private String layoutTemplateId;
    @NotEmpty(message = "内容模板至少需要一个模块")
    @Size(max = 100)
    private List<Map<String, Object>> modules;
    @Size(max = 20)
    private List<@Size(max = 32) String> tags;
    @NotBlank(message = "请选择发布状态")
    private String status;
    private String sourceType;
}
