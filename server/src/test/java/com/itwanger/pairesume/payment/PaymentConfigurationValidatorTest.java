package com.itwanger.pairesume.payment;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PaymentConfigurationValidatorTest {

    @Test
    void unconfiguredPaymentDoesNotBlockApplicationStartup() {
        MarketplacePaymentProperties properties = new MarketplacePaymentProperties();
        assertEquals(7, properties.getCreatorEarningHoldDays());
        assertDoesNotThrow(() -> validator(properties).validate());
    }

    @Test
    void configuredWechatNeedsNoModuleSwitches() {
        assertDoesNotThrow(() -> validator(validWechatProperties()).validate());
    }

    @Test
    void mockPaymentsRemainForbiddenInProduction() {
        MarketplacePaymentProperties properties = new MarketplacePaymentProperties();
        properties.setProvider("mock");
        assertThrows(IllegalStateException.class, () -> validator(properties, "production").validate());
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
        wechat.setRefundNotifyUrl("http://localhost/api/public/payments/wechat/refund-notify");
        return properties;
    }
}
