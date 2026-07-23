package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.AssertTrue;
import lombok.Data;

@Data
public class LegalConsentDTO {
    @AssertTrue(message = "请阅读并同意服务条款")
    private boolean termsAccepted;

    @AssertTrue(message = "请阅读并同意隐私政策")
    private boolean privacyAccepted;
}
