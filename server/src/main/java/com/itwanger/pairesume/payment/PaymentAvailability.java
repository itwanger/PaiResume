package com.itwanger.pairesume.payment;

/** All purchase flows use the same configured payment gateway. */
public final class PaymentAvailability {
    private PaymentAvailability() {}

    public static boolean isEnabled(MarketplacePaymentGateway gateway) {
        String provider = gateway.provider();
        return "wechat".equals(provider) || "mock".equals(provider);
    }
}
