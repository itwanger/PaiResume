package com.itwanger.pairesume.service;

public interface LoginRateLimitService {

    void acquireAttempt(String email, String clientIp);

    void recordSuccess(String email);
}
