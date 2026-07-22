package com.itwanger.pairesume.payment;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "app.payment", name = "provider", havingValue = "disabled", matchIfMissing = true)
public class DisabledMarketplacePaymentGateway implements MarketplacePaymentGateway {
    @Override
    public String provider() {
        return "disabled";
    }

    @Override
    public String expectedAppId() {
        return null;
    }

    @Override
    public String expectedMerchantId() {
        return null;
    }

    @Override
    public PaymentPrepayResult createNativeOrder(PaymentPrepayRequest request) {
        throw new BusinessException(ResultCode.PAYMENT_NOT_ENABLED);
    }

    @Override
    public ProviderPaymentResult queryOrder(String orderNo) {
        throw new BusinessException(ResultCode.PAYMENT_NOT_ENABLED);
    }

    @Override
    public void closeOrder(String orderNo) {
        throw new BusinessException(ResultCode.PAYMENT_NOT_ENABLED);
    }

    @Override
    public ProviderPaymentResult verifyNotification(PaymentNotificationRequest request) {
        throw new BusinessException(ResultCode.PAYMENT_NOT_ENABLED);
    }
}
