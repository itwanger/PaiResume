package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SettleCreatorEarningDTO {
    @NotBlank(message = "请填写线下转账流水或备注")
    @Size(max = 255, message = "结算备注不能超过 255 个字符")
    private String settlementNote;
}
