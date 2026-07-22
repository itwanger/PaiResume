package com.itwanger.pairesume.payment;

public enum MarketplaceOrderStatus {
    CREATED,
    PREPAYING,
    PREPAY_UNKNOWN,
    PENDING,
    PAID,
    DUPLICATE_PAID,
    REFUND_REQUIRED,
    CLOSED,
    FAILED,
    EXPIRED,
    REFUNDED;

    public boolean isActive() {
        return this == CREATED || this == PREPAYING || this == PENDING;
    }

    public boolean isProviderQueryable() {
        return this == PENDING || this == EXPIRED || this == PREPAY_UNKNOWN;
    }

    public boolean requiresProviderCloseBeforeReplacement() {
        return this == EXPIRED || this == PREPAY_UNKNOWN;
    }

    public static MarketplaceOrderStatus from(String value) {
        return MarketplaceOrderStatus.valueOf(value);
    }
}
