package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateResumeReviewUploadDTO {
    @NotNull
    private Long resumeId;
    @NotBlank
    @Size(max = 200)
    private String fileName;
    @NotNull
    @Min(5)
    private Long sizeBytes;
    @NotBlank
    @Pattern(regexp = "^[a-fA-F0-9]{64}$", message = "SHA-256 格式不正确")
    private String sha256;
}
