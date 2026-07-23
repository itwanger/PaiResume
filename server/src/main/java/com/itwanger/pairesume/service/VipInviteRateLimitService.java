package com.itwanger.pairesume.service;

public interface VipInviteRateLimitService {
    void acquireAttempt(String accountSubject, String clientIp);

    void acquireIpAttempt(String clientIp);
}
