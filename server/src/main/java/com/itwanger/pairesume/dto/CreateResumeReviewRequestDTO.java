package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class CreateResumeReviewRequestDTO {
    @NotNull
    private Long resumeId;
    @NotBlank @Size(max = 64)
    private String idempotencyKey;
    @NotBlank @Email @Size(max = 128)
    private String contactEmail;
    @Size(max = 12)
    private String verificationCode;
    @AssertTrue(message = "请同意将当前简历快照交给人工审阅")
    private Boolean manualReviewConsent;
    @AssertTrue(message = "请同意通过邮件向固定收件人发送简历 PDF")
    private Boolean emailDeliveryConsent;
}
