package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AccountDeletionDTO {
    @Size(max = 128, message = "密码长度不能超过128个字符")
    private String password;

    @Size(max = 128, message = "扫码确认凭证长度不能超过128个字符")
    private String wechatReauthProof;

    @jakarta.validation.constraints.NotBlank(message = "请输入注销确认文字")
    @Pattern(regexp = "^注销账号$", message = "请输入“注销账号”确认操作")
    private String confirmation;
}
