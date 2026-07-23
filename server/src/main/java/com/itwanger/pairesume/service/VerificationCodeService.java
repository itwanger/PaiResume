package com.itwanger.pairesume.service;

public interface VerificationCodeService {

    String issueRegistrationCode(String email, String clientIp);

    void rollbackRegistrationCode(String email);

    ConsumeResult consumeRegistrationCode(String email, String code);

    String issuePasswordResetCode(String email, String clientIp);

    void rollbackPasswordResetCode(String email);

    ConsumeResult consumePasswordResetCode(String email, String code);

    String issueResumeReviewContactCode(String email, String clientIp);

    void rollbackResumeReviewContactCode(String email);

    ConsumeResult consumeResumeReviewContactCode(String email, String code);

    enum ConsumeResult {
        VERIFIED,
        INVALID,
        EXPIRED,
        ATTEMPTS_EXCEEDED
    }
}
