package com.itwanger.pairesume.payment;

import jakarta.annotation.PostConstruct;
import com.itwanger.pairesume.config.ResumeReviewProperties;
import com.itwanger.pairesume.service.WechatPayConfigService;
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
    private final WechatPayConfigService wechatPayConfigService;

    @Autowired
    public PaymentConfigurationValidator(MarketplacePaymentProperties properties,
                                         ResumeReviewProperties resumeReviewProperties,
                                         WechatPayConfigService wechatPayConfigService) {
        this.properties = properties;
        this.resumeReviewProperties = resumeReviewProperties;
        this.wechatPayConfigService = wechatPayConfigService;
    }

    PaymentConfigurationValidator(MarketplacePaymentProperties properties) {
        this(properties, new ResumeReviewProperties(), null);
    }

    @Value("${app.environment:unset}")
    private String environment;

    @PostConstruct
    public void validate() {
        String provider = normalizedProvider();
        boolean adminWechatEnabled = wechatPayConfigService != null && wechatPayConfigService.isEnabled();
        boolean testWechatEnabled = wechatPayConfigService == null && "wechat-native".equals(provider);
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
                || properties.isMarketplaceAcceptNewOrders())
                && !"mock".equals(provider)
                && !adminWechatEnabled
                && !testWechatEnabled) {
            throw new IllegalStateException(
                    "Enabling new membership or marketplace orders requires "
                            + "mock payment in development or enabled WeChat Pay in Admin"
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
        if (adminWechatEnabled || testWechatEnabled) {
            validateWechat();
        }
    }

    public String normalizedProvider() {
        return properties.getProvider() == null ? "disabled" : properties.getProvider().trim().toLowerCase();
    }

    private void validateWechat() {
        WechatPayConfigService.ActiveWechatPayConfig wechat = activeWechat();
        require("WECHAT_PAY_APP_ID", wechat.appId());
        require("WECHAT_PAY_MERCHANT_ID", wechat.merchantId());
        require("WECHAT_PAY_PRIVATE_KEY", wechat.privateKey());
        require("WECHAT_PAY_MERCHANT_SERIAL_NUMBER", wechat.merchantSerialNumber());
        require("WECHAT_PAY_API_V3_KEY", wechat.apiV3Key());
        require("WECHAT_PAY_NOTIFY_URL", wechat.paymentNotifyUrl());
        require("WECHAT_PAY_REFUND_NOTIFY_URL", wechat.refundNotifyUrl());
        if (wechat.apiV3Key().length() != 32) {
            throw new IllegalStateException("WECHAT_PAY_API_V3_KEY must contain exactly 32 characters");
        }
        validateNotifyUrl("WECHAT_PAY_NOTIFY_URL", wechat.paymentNotifyUrl(),
                "/api/public/payments/wechat/notify");
        validateNotifyUrl("WECHAT_PAY_REFUND_NOTIFY_URL", wechat.refundNotifyUrl(),
                "/api/public/payments/wechat/refund-notify");
        if (wechat.paymentNotifyUrl().trim().equals(wechat.refundNotifyUrl().trim())) {
            throw new IllegalStateException(
                    "WECHAT_PAY_NOTIFY_URL and WECHAT_PAY_REFUND_NOTIFY_URL must be different");
        }
    }

    private WechatPayConfigService.ActiveWechatPayConfig activeWechat() {
        if (wechatPayConfigService != null) {
            return wechatPayConfigService.resolveActive();
        }
        MarketplacePaymentProperties.Wechat wechat = properties.getWechat();
        return new WechatPayConfigService.ActiveWechatPayConfig(
                wechat.getAppId(), wechat.getMerchantId(), wechat.getPrivateKey(),
                wechat.getMerchantSerialNumber(), wechat.getApiV3Key(),
                wechat.getNotifyUrl(), wechat.getRefundNotifyUrl(), false);
    }

    private void validateNotifyUrl(String name, String value, String expectedPath) {
        try {
            URI notifyUri = URI.create(value.trim());
            if (!StringUtils.hasText(notifyUri.getHost())
                    || !expectedPath.equals(notifyUri.getPath())) {
                throw new IllegalStateException(name + " must point to the exact PaiResume callback path");
            }
            if ("production".equalsIgnoreCase(normalizedEnvironment())
                    && !"https".equalsIgnoreCase(notifyUri.getScheme())) {
                throw new IllegalStateException(name + " must use HTTPS in production");
            }
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException(name + " must be a valid URL", exception);
        }
    }

    private void require(String name, String value) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalStateException(name + " is required when WeChat Pay is enabled in Admin");
        }
    }

    private String normalizedEnvironment() {
        return environment == null ? "" : environment.trim();
    }
}
