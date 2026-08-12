package com.itwanger.pairesume.dto;

import java.util.Map;

public record ResumePhotoUploadAuthorizationDTO(
        String photoNo,
        String uploadUrl,
        String method,
        Map<String, String> headers,
        Map<String, String> fields,
        String expiresAt,
        long maxSizeBytes
) {
}
