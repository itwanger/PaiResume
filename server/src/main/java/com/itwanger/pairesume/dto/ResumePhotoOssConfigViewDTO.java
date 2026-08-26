package com.itwanger.pairesume.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ResumePhotoOssConfigViewDTO {
    private String endpoint;
    private String bucket;
    private String objectPrefix;
    private String accessKeyIdMask;
    private String accessKeySecretMask;
    private boolean credentialsConfigured;
    private boolean masterKeyConfigured;
    private LocalDateTime updatedAt;
}
