package com.itwanger.pairesume.payment;

import jakarta.annotation.PostConstruct;
import com.itwanger.pairesume.config.ResumeReviewProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.util.Set;

@Component
public class PaymentConfigurationValidator {
    private static final Set<String> SUPPORTED_PROVIDERS = Set.of("disabled", "mock", "wechat-native");

    private final MarketplacePaymentProperties properties;
    private final ResumeReviewProperties resumeReviewProperties;

    @Autowired
    public PaymentConfigurationValidator(MarketplacePaymentProperties properties,
                                         ResumeReviewProperties resumeReviewProperties) {
        this.properties = properties;
        this.resumeReviewProperties = resumeReviewProperties;
    }

    PaymentConfigurationValidator(MarketplacePaymentProperties properties) {
        this(properties, new ResumeReviewProperties());
    }

    @Value("${app.environment:unset}")
    private String environment;

    @PostConstruct
    public void validate() {
        String provider = normalizedProvider();
        if (!SUPPORTED_PROVIDERS.contains(provider)) {
            throw new IllegalStateException("PAYMENT_PROVIDER must be disabled, mock, or wechat-native");
        }
        if (properties.isAcceptNewOrders()) {
            throw new IllegalStateException(
                    "PAYMENT_ACCEPT_NEW_ORDERS is deprecated and must remain false; use "
                            + "MEMBERSHIP_PAYMENT_ACCEPT_NEW_ORDERS or "
                            + "MARKETPLACE_PAYMENT_ACCEPT_NEW_ORDERS"
            );
        }
        if ((properties.isMembershipAcceptNewOrders()
                || properties.isMarketplaceAcceptNewOrders()) && "disabled".equals(provider)) {
            throw new IllegalStateException(
                    "Enabling new membership or marketplace orders requires "
                            + "PAYMENT_PROVIDER=mock or wechat-native"
            );
        }
        if (resumeReviewProperties.isPaidAcceptNewOrders() && !"wechat-native".equals(provider)) {
            throw new IllegalStateException(
                    "RESUME_REVIEW_PAID_ACCEPT_NEW_ORDERS requires PAYMENT_PROVIDER=wechat-native"
            );
        }
        if (resumeReviewProperties.getPaymentOrderExpireMinutes() != 30) {
            throw new IllegalStateException(
                    "RESUME_REVIEW_PAYMENT_ORDER_EXPIRE_MINUTES must be exactly 30"
            );
        }
        if (properties.getOrderExpireMinutes() < 5 || properties.getOrderExpireMinutes() > 120) {
            throw new IllegalStateException("PAYMENT_ORDER_EXPIRE_MINUTES must be between 5 and 120");
        }
        if (properties.getMembershipOrderExpireMinutes() != 30) {
            throw new IllegalStateException("MEMBERSHIP_ORDER_EXPIRE_MINUTES must be exactly 30");
        }
        if (properties.getMembershipPaymentDays() < 1 || properties.getMembershipPaymentDays() > 3650) {
            throw new IllegalStateException("MEMBERSHIP_PAYMENT_DAYS must be between 1 and 3650");
        }
        if ("production".equalsIgnoreCase(normalizedEnvironment())
                && properties.getMembershipPaymentDays() != 365) {
            throw new IllegalStateException("MEMBERSHIP_PAYMENT_DAYS must be exactly 365 in production");
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
