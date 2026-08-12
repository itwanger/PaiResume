package com.itwanger.pairesume.service;

import java.time.LocalDateTime;
import java.util.Map;

public interface ResumePhotoObjectStorage {
    UploadTarget createUploadTarget(String stagingObjectKey, long expectedSizeBytes,
                                    String contentType, String sha256, LocalDateTime expiresAt);

    StoredPhoto finalizePhoto(String stagingObjectKey, String objectKey,
                              String contentType, long expectedSizeBytes, String expectedSha256,
                              int expectedWidth, int expectedHeight);

    String createAccessUrl(String objectKey, LocalDateTime expiresAt);

    void deleteObject(String objectKey);

    record UploadTarget(String uploadUrl, String method, Map<String, String> headers,
                        Map<String, String> fields) {
    }

    record StoredPhoto(String objectKey, String etag, long sizeBytes, int width, int height) {
    }
}
