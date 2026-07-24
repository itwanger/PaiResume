package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumeReviewOssProperties;
import org.springframework.stereotype.Component;

import java.util.concurrent.Semaphore;
import java.util.function.Supplier;

@Component
public class ResumeReviewUploadCompletionGuard {
    private final Semaphore permits;

    public ResumeReviewUploadCompletionGuard(ResumeReviewOssProperties properties) {
        this.permits = new Semaphore(properties.getMaxConcurrentFinalizations(), true);
    }

    public <T> T execute(Supplier<T> action) {
        if (!permits.tryAcquire()) {
            throw new BusinessException(
                    ResultCode.RESUME_REVIEW_STORAGE_UNAVAILABLE.getCode(),
                    "PDF 核验任务繁忙，请稍后重试");
        }
        try {
            return action.get();
        } finally {
            permits.release();
        }
    }
}
