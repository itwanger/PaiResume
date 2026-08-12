package com.itwanger.pairesume.dto;

public record ResumePhotoDTO(
        Long id,
        String photoNo,
        String contentType,
        long sizeBytes,
        int width,
        int height,
        String accessUrl,
        String accessUrlExpiresAt
) {
}
