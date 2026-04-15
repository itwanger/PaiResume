package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class FeedbackSubmissionCreateDTO {
    @NotBlank(message = "联系邮箱不能为空")
    @Email(message = "邮箱格式不正确")
    private String contactEmail;

    @NotBlank(message = "展示名称不能为空")
    private String displayName;

    @NotBlank(message = "学校或公司不能为空")
    private String schoolOrCompany;

    @NotBlank(message = "目标岗位不能为空")
    private String targetRole;

    @NotNull(message = "评分不能为空")
    @Min(value = 1, message = "评分不能低于 1")
    @Max(value = 5, message = "评分不能高于 5")
    private Integer rating;

    @NotBlank(message = "评价内容不能为空")
    private String testimonialText;

    private String desiredFeatures;

    private String bugFeedback;

    @NotNull(message = "请确认是否同意公开评价")
    private Boolean consentToPublish;
}
