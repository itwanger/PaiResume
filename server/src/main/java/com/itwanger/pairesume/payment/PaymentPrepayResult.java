package com.itwanger.pairesume.payment;

import java.time.LocalDateTime;

public record PaymentPrepayResult(
        String provider,
        String providerPrepayId,
        String codeUrl,
        LocalDateTime expiresAt
) {
}
