package com.itwanger.pairesume.service;

public interface ResumePhotoUploadRateLimitService {
    void acquireAttempt(String action, Long userId, String clientIp);
}
