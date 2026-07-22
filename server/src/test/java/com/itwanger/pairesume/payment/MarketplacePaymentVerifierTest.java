package com.itwanger.pairesume.payment;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.entity.ResumeViewOrder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MarketplacePaymentVerifierTest {
    private MarketplacePaymentVerifier verifier;
    private ResumeViewOrder order;

    @BeforeEach
    void setUp() {
        MarketplacePaymentGateway gateway = mock(MarketplacePaymentGateway.class);
        when(gateway.provider()).thenReturn("wechat");
        when(gateway.expectedAppId()).thenReturn("app-id");
        when(gateway.expectedMerchantId()).thenReturn("merchant-id");
        verifier = new MarketplacePaymentVerifier(gateway);

        order = new ResumeViewOrder();
        order.setOrderNo("PR-1");
        order.setProvider("wechat");
        order.setAmountCents(990);
    }

    @Test
    void rejectsMismatchedPaymentIdentity() {
        ProviderPaymentResult result = paid("other-app", "merchant-id", 990);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> verifier.verify(order, result));

        assertEquals(ResultCode.PAYMENT_NOTIFICATION_INVALID.getCode(), exception.getCode());
    }

    @Test
    void rejectsMismatchedAmount() {
        ProviderPaymentResult result = paid("app-id", "merchant-id", 991);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> verifier.verify(order, result));

        assertEquals(ResultCode.PAYMENT_AMOUNT_MISMATCH.getCode(), exception.getCode());
    }

    @Test
    void acceptsTrustedTerminalMissingOrderWithoutAmount() {
        ProviderPaymentResult result = new ProviderPaymentResult(
                PaymentProviderState.FAILED, "PR-1", null,
                "app-id", "merchant-id", "CNY", null, null);

        verifier.verify(order, result);
    }

    @Test
    void rejectsRefundStateWithoutProviderTransactionIdentity() {
        ProviderPaymentResult result = new ProviderPaymentResult(
                PaymentProviderState.REFUND_PENDING_VERIFICATION, "PR-1", null,
                "app-id", "merchant-id", "CNY", 990, LocalDateTime.now());

        BusinessException exception = assertThrows(BusinessException.class,
                () -> verifier.verify(order, result));

        assertEquals(ResultCode.PAYMENT_NOTIFICATION_INVALID.getCode(), exception.getCode());
    }

    @Test
    void rejectsRefundForDifferentProviderTransaction() {
        order.setProviderTransactionId("TX-ORIGINAL");
        ProviderPaymentResult result = new ProviderPaymentResult(
                PaymentProviderState.REFUND_PENDING_VERIFICATION, "PR-1", "TX-OTHER",
                "app-id", "merchant-id", "CNY", 990, LocalDateTime.now());

        BusinessException exception = assertThrows(BusinessException.class,
                () -> verifier.verify(order, result));

        assertEquals(ResultCode.PAYMENT_NOTIFICATION_INVALID.getCode(), exception.getCode());
    }

    private ProviderPaymentResult paid(String appId, String merchantId, int amount) {
        return new ProviderPaymentResult(PaymentProviderState.PAID, "PR-1", "TX-1",
                appId, merchantId, "CNY", amount, LocalDateTime.now());
    }
}
