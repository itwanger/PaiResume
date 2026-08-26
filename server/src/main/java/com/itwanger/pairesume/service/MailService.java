package com.itwanger.pairesume.service;

public interface MailService {
    void sendVerificationCode(String email, String code);

    void sendPasswordResetCode(String email, String code);

    void sendEmailBindingCode(String email, String code);

    void sendCouponCode(String email, String couponCode, int amountCents);

    void sendResumeReviewContactCode(String email, String code);

    void sendResumeReview(String recipientEmail, String messageId, String requestNo,
                          String contactEmail, byte[] pdfContent, String fileName);
}
