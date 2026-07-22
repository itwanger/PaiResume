package com.itwanger.pairesume.payment;

public interface MarketplacePaymentGateway {
    String provider();

    String expectedAppId();

    String expectedMerchantId();

    PaymentPrepayResult createNativeOrder(PaymentPrepayRequest request);

    ProviderPaymentResult queryOrder(String orderNo);

    void closeOrder(String orderNo);

    ProviderPaymentResult verifyNotification(PaymentNotificationRequest request);
}
