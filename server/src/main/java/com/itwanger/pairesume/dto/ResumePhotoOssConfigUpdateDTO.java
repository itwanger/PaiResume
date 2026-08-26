package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResumePhotoOssConfigUpdateDTO {
    @Size(max = 255, message = "OSS endpoint cannot exceed 255 characters")
    private String endpoint;

    @Size(max = 63, message = "OSS bucket cannot exceed 63 characters")
    private String bucket;

    @Size(max = 128, message = "OSS object prefix cannot exceed 128 characters")
    private String objectPrefix;

    /** Blank means keep the currently encrypted value. */
    @Size(max = 256, message = "AccessKey ID cannot exceed 256 characters")
    private String accessKeyId;

    /** Blank means keep the currently encrypted value. */
    @Size(max = 512, message = "AccessKey secret cannot exceed 512 characters")
    private String accessKeySecret;

}
