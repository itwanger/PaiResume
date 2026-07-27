package com.itwanger.pairesume.payment;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import com.itwanger.pairesume.config.ResumeReviewProperties;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PaymentConfigurationValidatorTest {

    @Test
    void acceptingNewOrdersDefaultsToFailClosed() {
        assertFalse(new MarketplacePaymentProperties().isAcceptNewOrders());
        assertFalse(new MarketplacePaymentProperties().isMembershipAcceptNewOrders());
        assertFalse(new MarketplacePaymentProperties().isMarketplaceAcceptNewOrders());
        assertEquals(7, new MarketplacePaymentProperties().getCreatorEarningHoldDays());
    }

    @Test
    void legacyGlobalSwitchAlwaysFailsClosed() {
        MarketplacePaymentProperties properties = new MarketplacePaymentProperties();
        properties.setProvider("wechat-native");
        properties.setAcceptNewOrders(true);

        assertThrows(IllegalStateException.class, () -> validator(properties).validate());
    }

    @Test
    void disabledProviderCannotAcceptIndependentNewOrders() {
        MarketplacePaymentProperties properties = new MarketplacePaymentProperties();
        properties.setProvider("disabled");
        properties.setMembershipAcceptNewOrders(true);

        assertThrows(IllegalStateException.class, () -> validator(properties).validate());
    }

    @Test
    void paidResumeReviewHasAnIndependentFailClosedSwitchAndRequiresWechatNative() {
        MarketplacePaymentProperties properties = new MarketplacePaymentProperties();
        ResumeReviewProperties review = new ResumeReviewProperties();
        review.setPaidAcceptNewOrders(true);
        PaymentConfigurationValidator validator = new PaymentConfigurationValidator(properties, review);
        ReflectionTestUtils.setField(validator, "environment", "development");

        assertThrows(IllegalStateException.class, validator::validate);
    }

    @Test
    void configuredWechatProviderCanStayAliveWhileNewOrdersArePaused() {
        MarketplacePaymentProperties properties = validWechatProperties();
        properties.setMembershipAcceptNewOrders(false);
        properties.setMarketplaceAcceptNewOrders(false);

        assertDoesNotThrow(() -> validator(properties).validate());
    }

    @Test
    void membershipAndMarketplaceSwitchesCanBeEnabledIndependently() {
        MarketplacePaymentProperties properties = validWechatProperties();
        properties.setMembershipAcceptNewOrders(true);
        properties.setMarketplaceAcceptNewOrders(false);

        assertDoesNotThrow(() -> validator(properties).validate());
    }

    @Test
    void zeroDayHoldIsAllowedOnlyForNonProductionE2e() {
        MarketplacePaymentProperties properties = new MarketplacePaymentProperties();
        properties.setCreatorEarningHoldDays(0);

        assertDoesNotThrow(() -> validator(properties).validate());
        assertThrows(IllegalStateException.class,
                () -> validator(properties, "production").validate());
    }

    private PaymentConfigurationValidator validator(MarketplacePaymentProperties properties) {
        return validator(properties, "development");
    }

    private PaymentConfigurationValidator validator(MarketplacePaymentProperties properties,
                                                    String environment) {
        PaymentConfigurationValidator validator = new PaymentConfigurationValidator(properties);
        ReflectionTestUtils.setField(validator, "environment", environment);
        return validator;
    }

    private MarketplacePaymentProperties validWechatProperties() {
        MarketplacePaymentProperties properties = new MarketplacePaymentProperties();
        properties.setProvider("wechat-native");
        MarketplacePaymentProperties.Wechat wechat = properties.getWechat();
        wechat.setAppId("wx-app");
        wechat.setMerchantId("merchant");
        wechat.setPrivateKey("configured-outside-source-control");
        wechat.setMerchantSerialNumber("serial");
        wechat.setApiV3Key("12345678901234567890123456789012");
        wechat.setNotifyUrl("http://localhost/api/public/payments/wechat/notify");
        return properties;
    }
}
