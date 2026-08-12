package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class ResumeMaterialUpsertDTO {
    @NotBlank(message = "请选择资料类型")
    @Size(max = 32, message = "资料类型过长")
    private String moduleType;

    @NotBlank(message = "请输入资料名称")
    @Size(max = 128, message = "资料名称不能超过 128 个字符")
    private String title;

    @NotNull(message = "资料内容不能为空")
    private Map<String, Object> content;

    @Size(max = 20, message = "标签不能超过 20 个")
    private List<@Size(max = 32, message = "单个标签不能超过 32 个字符") String> tags;
}
