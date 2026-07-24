package com.itwanger.pairesume.service;

public interface ResumeReviewUploadRateLimitService {
    void acquireAttempt(String action, Long userId, String clientIp);
}
