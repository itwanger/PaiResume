package com.itwanger.pairesume.payment;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class PaymentConfigurationValidator {
    private static final Set<String> SUPPORTED_PROVIDERS = Set.of("disabled", "mock", "wechat-native");

    private final MarketplacePaymentProperties properties;

    @Value("${app.environment:unset}")
    private String environment;

    @PostConstruct
    public void validate() {
        String provider = normalizedProvider();
        if (!SUPPORTED_PROVIDERS.contains(provider)) {
            throw new IllegalStateException("PAYMENT_PROVIDER must be disabled, mock, or wechat-native");
        }
        if (properties.isAcceptNewOrders() && "disabled".equals(provider)) {
            throw new IllegalStateException(
                    "PAYMENT_ACCEPT_NEW_ORDERS=true requires PAYMENT_PROVIDER=mock or wechat-native"
            );
        }
        if (properties.getOrderExpireMinutes() < 5 || properties.getOrderExpireMinutes() > 120) {
            throw new IllegalStateException("PAYMENT_ORDER_EXPIRE_MINUTES must be between 5 and 120");
        }
        if (properties.getPlatformFeeBasisPoints() < 0 || properties.getPlatformFeeBasisPoints() > 5000) {
            throw new IllegalStateException("MARKETPLACE_PLATFORM_FEE_BPS must be between 0 and 5000");
        }
        if (properties.getCreatorEarningHoldDays() < 0 || properties.getCreatorEarningHoldDays() > 90) {
            throw new IllegalStateException("MARKETPLACE_EARNING_HOLD_DAYS must be between 0 and 90");
        }
        if ("production".equalsIgnoreCase(normalizedEnvironment())
                && properties.getCreatorEarningHoldDays() < 1) {
            throw new IllegalStateException("MARKETPLACE_EARNING_HOLD_DAYS must be at least 1 in production");
        }
        if (properties.getPaidOrderReconciliationIntervalMinutes() < 5
                || properties.getPaidOrderReconciliationIntervalMinutes() > 1440) {
            throw new IllegalStateException(
                    "MARKETPLACE_PAID_RECONCILIATION_INTERVAL_MINUTES must be between 5 and 1440");
        }
        if (properties.getPaidOrderDueReconciliationRetryMinutes() < 1
                || properties.getPaidOrderDueReconciliationRetryMinutes() > 60) {
            throw new IllegalStateException(
                    "MARKETPLACE_PAID_DUE_RECONCILIATION_RETRY_MINUTES must be between 1 and 60");
        }
        if ("mock".equals(provider) && "production".equalsIgnoreCase(normalizedEnvironment())) {
            throw new IllegalStateException("Mock payment provider is forbidden in production");
        }
        if ("wechat-native".equals(provider)) {
            validateWechat();
        }
    }

    public String normalizedProvider() {
        return properties.getProvider() == null ? "disabled" : properties.getProvider().trim().toLowerCase();
    }

    private void validateWechat() {
        MarketplacePaymentProperties.Wechat wechat = properties.getWechat();
        require("WECHAT_PAY_APP_ID", wechat.getAppId());
        require("WECHAT_PAY_MERCHANT_ID", wechat.getMerchantId());
        require("WECHAT_PAY_PRIVATE_KEY", wechat.getPrivateKey());
        require("WECHAT_PAY_MERCHANT_SERIAL_NUMBER", wechat.getMerchantSerialNumber());
        require("WECHAT_PAY_API_V3_KEY", wechat.getApiV3Key());
        require("WECHAT_PAY_NOTIFY_URL", wechat.getNotifyUrl());
        if (wechat.getApiV3Key().length() != 32) {
            throw new IllegalStateException("WECHAT_PAY_API_V3_KEY must contain exactly 32 characters");
        }
        try {
            URI notifyUri = URI.create(wechat.getNotifyUrl().trim());
            if (!StringUtils.hasText(notifyUri.getHost()) || !notifyUri.getPath().endsWith("/api/public/payments/wechat/notify")) {
                throw new IllegalStateException("WECHAT_PAY_NOTIFY_URL must point to the exact PaiResume callback path");
            }
            if ("production".equalsIgnoreCase(normalizedEnvironment())
                    && !"https".equalsIgnoreCase(notifyUri.getScheme())) {
                throw new IllegalStateException("WECHAT_PAY_NOTIFY_URL must use HTTPS in production");
            }
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("WECHAT_PAY_NOTIFY_URL must be a valid URL", exception);
        }
    }

    private void require(String name, String value) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalStateException(name + " is required when PAYMENT_PROVIDER=wechat-native");
        }
    }

    private String normalizedEnvironment() {
        return environment == null ? "" : environment.trim();
    }
}
