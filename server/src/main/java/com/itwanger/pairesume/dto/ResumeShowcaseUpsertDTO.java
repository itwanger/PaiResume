package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class ResumeShowcaseUpsertDTO {
    @NotNull(message = "请选择简历")
    private Long resumeId;

    @NotBlank(message = "slug 不能为空")
    private String slug;

    @NotBlank(message = "分数标签不能为空")
    private String scoreLabel;

    @NotBlank(message = "摘要不能为空")
    private String summary;

    private List<String> tags;

    @NotNull(message = "排序不能为空")
    private Integer displayOrder;

    @NotBlank(message = "发布状态不能为空")
    private String publishStatus;
}
