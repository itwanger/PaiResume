package com.itwanger.pairesume.payment;

import java.time.LocalDateTime;

public record PaymentPrepayRequest(
        String orderNo,
        String description,
        int amountCents,
        String clientIp,
        LocalDateTime expiresAt
) {
}
