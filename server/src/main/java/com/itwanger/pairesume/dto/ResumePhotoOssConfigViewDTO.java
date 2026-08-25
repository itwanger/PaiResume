package com.itwanger.pairesume.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ResumePhotoOssConfigViewDTO {
    private String endpoint;
    private String bucket;
    private String accessKeyIdMask;
    private String accessKeySecretMask;
    private boolean credentialsConfigured;
    private boolean privateBucketConfirmed;
    private boolean corsConfirmed;
    private boolean stagingLifecycleConfirmed;
    private boolean ramPolicyConfirmed;
    private boolean enabled;
    private boolean masterKeyConfigured;
    private LocalDateTime updatedAt;
}
