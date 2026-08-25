package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PlatformConfigDTO {
    @NotNull(message = "会员价格不能为空")
    @Min(value = 0, message = "会员价格不能小于 0")
    private Integer membershipPriceCents;

    @NotNull(message = "问卷优惠金额不能为空")
    @Min(value = 0, message = "问卷优惠金额不能小于 0")
    private Integer questionnaireCouponAmountCents;

    @NotNull(message = "人工精修价格不能为空")
    @Min(value = 0, message = "人工精修价格不能小于 0")
    private Integer resumeReviewPriceCents;

    @NotBlank(message = "人工精修收件邮箱不能为空")
    @Email(message = "人工精修收件邮箱格式不正确")
    @Size(max = 128, message = "人工精修收件邮箱不能超过 128 个字符")
    private String resumeReviewRecipientEmail;
}
