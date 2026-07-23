package com.itwanger.pairesume.payment;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.entity.MembershipPaymentOrder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MembershipPaymentVerifierTest {
    @Mock private MarketplacePaymentGateway gateway;
    private MembershipPaymentVerifier verifier;
    private MembershipPaymentOrder order;

    @BeforeEach
    void setUp() {
        verifier = new MembershipPaymentVerifier(gateway);
        order = new MembershipPaymentOrder();
        order.setOrderNo("PM123");
        order.setProvider("wechat");
        order.setPayableAmountCents(6600);
        when(gateway.provider()).thenReturn("wechat");
        when(gateway.expectedAppId()).thenReturn("app");
        when(gateway.expectedMerchantId()).thenReturn("merchant");
    }

    @Test
    void acceptsMatchingPaidResult() {
        assertDoesNotThrow(() -> verifier.verify(order, paid("app", "merchant", 6600,
                LocalDateTime.now())));
    }

    @Test
    void rejectsAmountMismatch() {
        assertThrows(BusinessException.class,
                () -> verifier.verify(order, paid("app", "merchant", 6599, LocalDateTime.now())));
    }

    @Test
    void rejectsAppOrMerchantMismatch() {
        assertThrows(BusinessException.class,
                () -> verifier.verify(order, paid("other-app", "merchant", 6600, LocalDateTime.now())));
        assertThrows(BusinessException.class,
                () -> verifier.verify(order, paid("app", "other-merchant", 6600, LocalDateTime.now())));
    }

    @Test
    void rejectsPaidResultWithoutPaidAt() {
        assertThrows(BusinessException.class,
                () -> verifier.verify(order, paid("app", "merchant", 6600, null)));
    }

    private ProviderPaymentResult paid(String appId, String merchantId,
                                       int amountCents, LocalDateTime paidAt) {
        return new ProviderPaymentResult(
                PaymentProviderState.PAID, "PM123", "tx", appId, merchantId,
                "CNY", amountCents, paidAt);
    }
}
