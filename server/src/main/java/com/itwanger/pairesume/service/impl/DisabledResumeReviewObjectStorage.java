package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.service.ResumeReviewObjectStorage;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@ConditionalOnProperty(name = "app.resume-review.oss.enabled", havingValue = "false", matchIfMissing = true)
public class DisabledResumeReviewObjectStorage implements ResumeReviewObjectStorage {

    @Override
    public UploadTarget createPdfUploadTarget(String stagingObjectKey, long expectedSizeBytes,
                                              String sha256, LocalDateTime expiresAt) {
        throw unavailable();
    }

    @Override
    public FrozenPdf freezeUploadedPdf(String stagingObjectKey, String finalObjectKey,
                                       String originalFileName, long expectedSizeBytes,
                                       String expectedSha256) {
        throw unavailable();
    }

    @Override
    public byte[] readVerifiedPdf(String objectKey, long expectedSizeBytes, String expectedSha256) {
        throw unavailable();
    }

    private BusinessException unavailable() {
        return new BusinessException(ResultCode.RESUME_REVIEW_STORAGE_NOT_CONFIGURED);
    }
}
