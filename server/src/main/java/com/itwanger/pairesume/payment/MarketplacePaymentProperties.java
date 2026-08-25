package com.itwanger.pairesume.payment;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.payment")
public class MarketplacePaymentProperties {
    private String provider = "disabled";
    /**
     * Deprecated global switch kept only so an old deployment fails closed
     * instead of silently enabling both independent sales channels.
     */
    private boolean acceptNewOrders = false;
    private boolean membershipAcceptNewOrders = false;
    private boolean marketplaceAcceptNewOrders = false;
    private boolean showcaseAcceptNewOrders = false;
    private int orderExpireMinutes = 15;
    private int membershipOrderExpireMinutes = 30;
    private int platformFeeBasisPoints = 0;
    private int creatorEarningHoldDays = 7;
    private int paidOrderReconciliationIntervalMinutes = 360;
    private int paidOrderDueReconciliationRetryMinutes = 5;
    private boolean mockAutoPay = true;
    private Wechat wechat = new Wechat();

    @Data
    public static class Wechat {
        private String appId;
        private String merchantId;
        private String privateKey;
        private String merchantSerialNumber;
        private String apiV3Key;
        private String notifyUrl;
    }
}
