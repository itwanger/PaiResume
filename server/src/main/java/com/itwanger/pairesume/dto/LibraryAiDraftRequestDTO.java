package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class LibraryAiDraftRequestDTO {
    @NotBlank(message = "请选择生成类型")
    private String kind;
    @NotBlank(message = "请选择模块类型")
    private String moduleType;
    @Size(max = 128)
    private String targetRole;
    @Size(max = 64)
    private String careerStage;
    @Size(max = 20)
    private List<@Size(max = 32) String> techStack;
    private Map<String, Object> facts;
}
