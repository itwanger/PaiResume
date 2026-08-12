package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class CreateResumePhotoUploadDTO {
    @NotBlank @Size(max = 200)
    private String fileName;
    @Positive
    private long sizeBytes;
    @NotBlank @Pattern(regexp = "(?i)^[0-9a-f]{64}$")
    private String sha256;
    @NotBlank @Pattern(regexp = "^image/(png|jpeg)$")
    private String contentType;
    @Positive
    private int width;
    @Positive
    private int height;
}
