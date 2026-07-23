package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class CompleteVipInviteClaimDTO {
    @NotBlank(message = "领取凭证不能为空")
    @Pattern(regexp = "[A-Za-z0-9_-]{43}", message = "领取凭证格式错误")
    private String claimToken;
}
