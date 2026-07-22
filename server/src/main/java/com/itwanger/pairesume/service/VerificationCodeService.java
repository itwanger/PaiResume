package com.itwanger.pairesume.service;

public interface VerificationCodeService {

    String issueRegistrationCode(String email, String clientIp);

    void rollbackRegistrationCode(String email);

    ConsumeResult consumeRegistrationCode(String email, String code);

    enum ConsumeResult {
        VERIFIED,
        INVALID,
        EXPIRED,
        ATTEMPTS_EXCEEDED
    }
}
