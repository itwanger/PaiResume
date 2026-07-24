package com.itwanger.pairesume.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ResumeReviewUploadDTO {
    private String uploadNo;
    private String fileName;
    private long sizeBytes;
    private String sha256;
    private String status;
}
