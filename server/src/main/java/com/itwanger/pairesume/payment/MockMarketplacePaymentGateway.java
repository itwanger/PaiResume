package com.itwanger.pairesume.payment;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Set;

@Component
@ConditionalOnProperty(prefix = "app.payment", name = "provider", havingValue = "mock")
public class MockMarketplacePaymentGateway implements MarketplacePaymentGateway {
    private final MarketplacePaymentProperties properties;
    private final Map<String, PaymentPrepayRequest> orders = new ConcurrentHashMap<>();
    private final Set<String> closedOrders = ConcurrentHashMap.newKeySet();

    public MockMarketplacePaymentGateway(MarketplacePaymentProperties properties) {
        this.properties = properties;
    }

    @Override
    public String provider() {
        return "mock";
    }

    @Override
    public String expectedAppId() {
        return "mock-app";
    }

    @Override
    public String expectedMerchantId() {
        return "mock-merchant";
    }

    @Override
    public PaymentPrepayResult createNativeOrder(PaymentPrepayRequest request) {
        orders.putIfAbsent(request.orderNo(), request);
        String codeUrl = "pairesume://mock-pay/" + request.orderNo();
        return new PaymentPrepayResult(provider(), "MOCK-" + request.orderNo(), codeUrl, request.expiresAt());
    }

    @Override
    public ProviderPaymentResult queryOrder(String orderNo) {
        PaymentPrepayRequest order = orders.get(orderNo);
        if (order == null) {
            return new ProviderPaymentResult(PaymentProviderState.FAILED, orderNo, null,
                    "mock-app", "mock-merchant", "CNY", null, null);
        }
        PaymentProviderState state = closedOrders.contains(orderNo)
                ? PaymentProviderState.CLOSED
                : properties.isMockAutoPay()
                ? PaymentProviderState.PAID : PaymentProviderState.PENDING;
        return new ProviderPaymentResult(state, orderNo,
                state == PaymentProviderState.PAID ? "MOCK-TX-" + orderNo : null,
                "mock-app", "mock-merchant", "CNY", order.amountCents(),
                state == PaymentProviderState.PAID ? LocalDateTime.now() : null);
    }

    @Override
    public void closeOrder(String orderNo) {
        if (orders.containsKey(orderNo)) {
            closedOrders.add(orderNo);
        }
    }

    @Override
    public ProviderPaymentResult verifyNotification(PaymentNotificationRequest request) {
        throw new UnsupportedOperationException("Mock payment provider does not accept public notifications");
    }
}
