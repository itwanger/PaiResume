package com.itwanger.pairesume.payment;

import java.time.LocalDateTime;

public record ProviderPaymentResult(
        PaymentProviderState state,
        String orderNo,
        String transactionId,
        String appId,
        String merchantId,
        String currency,
        Integer amountCents,
        LocalDateTime paidAt
) {
}
