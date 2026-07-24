package com.itwanger.pairesume.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.Map;

@Data
@AllArgsConstructor
public class ResumeReviewUploadAuthorizationDTO {
    private String uploadNo;
    private String uploadUrl;
    private String method;
    private Map<String, String> headers;
    private Map<String, String> fields;
    private String expiresAt;
    private long maxSizeBytes;
}
