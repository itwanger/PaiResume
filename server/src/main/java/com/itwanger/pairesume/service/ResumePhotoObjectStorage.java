package com.itwanger.pairesume.service;

import java.time.LocalDateTime;
import java.util.Map;

public interface ResumePhotoObjectStorage {
    UploadTarget createUploadTarget(String stagingObjectKey, long expectedSizeBytes,
                                    String contentType, String sha256, LocalDateTime expiresAt);

    StoredPhoto finalizePhoto(String stagingObjectKey, String objectKey,
                              String contentType, long expectedSizeBytes, String expectedSha256,
                              int expectedWidth, int expectedHeight);

    byte[] readPhoto(String objectKey, long expectedSizeBytes);

    String createAccessUrl(String objectKey, LocalDateTime expiresAt);

    /** Publish an independent account avatar; the original resume photo stays private. */
    String publishAvatar(String objectKey, String avatarObjectKey);

    void deleteObject(String objectKey);

    record UploadTarget(String uploadUrl, String method, Map<String, String> headers,
                        Map<String, String> fields) {
    }

    record StoredPhoto(String objectKey, String etag, long sizeBytes, int width, int height) {
    }
}
