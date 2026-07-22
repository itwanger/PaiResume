package com.itwanger.pairesume.payment;

public record PaymentNotificationRequest(
        String serialNumber,
        String nonce,
        String timestamp,
        String signature,
        String body
) {
}
