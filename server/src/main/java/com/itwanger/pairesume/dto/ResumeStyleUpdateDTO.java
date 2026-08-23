package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class ResumeStyleUpdateDTO {
    @NotBlank(message = "请选择 PDF 页面模式")
    @Pattern(regexp = "standard|continuous", message = "PDF 页面模式不受支持")
    private String pageMode;

    @NotBlank(message = "请选择简历模板")
    @Pattern(
            regexp = "default|compact|accent|campus-blue|technical-black|minimal|executive|warm|slate|focus",
            message = "简历模板不受支持"
    )
    private String templateId;

    @NotBlank(message = "请选择内容密度")
    @Pattern(regexp = "normal|compact", message = "内容密度不受支持")
    private String density;

    @NotBlank(message = "请选择简历主色")
    @Pattern(regexp = "auto|blue|slate|warm|emerald", message = "简历主色不受支持")
    private String accentPreset;

    @NotBlank(message = "请选择标题样式")
    @Pattern(regexp = "auto|underline|filled|bar", message = "标题样式不受支持")
    private String headingStyle;
}
