package com.itwanger.pairesume.service;

public interface VipInviteRateLimitService {
    void acquireAttempt(String email, String clientIp);
}
