package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class CreateResumeReviewRequestDTO {
    private Long resumeId;
    @NotBlank @Size(max = 200)
    private String fileName;
    @NotNull @Min(5) @Max(5242880)
    private Long sizeBytes;
    @NotBlank @Pattern(regexp = "^[0-9a-fA-F]{64}$")
    private String sha256;
    @NotBlank @Size(max = 64)
    private String idempotencyKey;
    @NotNull @Min(0) @Max(100000)
    private Integer priorityFeeCents;
    @NotBlank @Email @Size(max = 128)
    private String contactEmail;
    @Size(max = 12)
    private String verificationCode;
}
