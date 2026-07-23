package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateVipInviteClaimDTO {
    @NotBlank(message = "邀请码不能为空")
    @Size(max = 64, message = "邀请码长度不能超过64个字符")
    private String code;
}
