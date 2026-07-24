package com.itwanger.pairesume.service;

import java.time.LocalDateTime;
import java.util.Map;

public interface ResumeReviewObjectStorage {

    UploadTarget createPdfUploadTarget(String stagingObjectKey, long expectedSizeBytes,
                                       String sha256, LocalDateTime expiresAt);

    FrozenPdf freezeUploadedPdf(String stagingObjectKey, String finalObjectKey,
                                String originalFileName, long expectedSizeBytes,
                                String expectedSha256);

    byte[] readVerifiedPdf(String objectKey, long expectedSizeBytes, String expectedSha256);

    record UploadTarget(String uploadUrl, String method, Map<String, String> headers,
                        Map<String, String> fields) {
    }

    record FrozenPdf(String objectKey, String etag, long sizeBytes) {
    }
}
