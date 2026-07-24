package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class CreateResumeReviewRequestDTO {
    @NotNull
    private Long resumeId;
    @NotBlank @Size(max = 64)
    private String uploadNo;
    @NotBlank @Size(max = 64)
    private String idempotencyKey;
    @NotBlank @Email @Size(max = 128)
    private String contactEmail;
    @Size(max = 12)
    private String verificationCode;
    @AssertTrue(message = "请同意将所选 PDF 交给人工审阅")
    private Boolean manualReviewConsent;
    @AssertTrue(message = "请同意将所选 PDF 发送到固定人工审阅邮箱")
    private Boolean emailDeliveryConsent;
}
