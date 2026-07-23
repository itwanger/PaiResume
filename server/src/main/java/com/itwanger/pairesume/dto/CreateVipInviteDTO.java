package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateVipInviteDTO {
    @Size(max = 128, message = "备注不能超过128个字符")
    private String remark;

    @Min(value = 1, message = "有效天数不能少于1天")
    @Max(value = 365, message = "有效天数不能超过365天")
    private Integer expiresInDays;

    @Min(value = 1, message = "兑换名额不能少于1人")
    @Max(value = 100000, message = "兑换名额不能超过100000人")
    private Integer maxRedemptions;

    @Min(value = 1, message = "会员权益天数不能少于1天")
    @Max(value = 365, message = "会员权益天数不能超过365天")
    private Integer membershipDays;

    @AssertTrue(message = "会员权益天数只能选择30天、90天或365天")
    public boolean isMembershipDaysSupported() {
        return membershipDays == null
                || membershipDays == 30
                || membershipDays == 90
                || membershipDays == 365;
    }
}
