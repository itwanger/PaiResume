package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.payment.MarketplacePaymentGateway;
import com.itwanger.pairesume.payment.PaymentNotificationRequest;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import com.itwanger.pairesume.service.MarketplaceOrderService;
import com.itwanger.pairesume.service.MembershipOrderService;
import com.itwanger.pairesume.service.ResumeReviewService;
import com.itwanger.pairesume.service.ShowcasePurchaseService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentNotificationDispatcherTest {
    @Mock private MarketplacePaymentGateway gateway;
    @Mock private MarketplaceOrderService marketplaceOrderService;
    @Mock private MembershipOrderService membershipOrderService;
    @Mock private ShowcasePurchaseService showcasePurchaseService;
    @Mock private ResumeReviewService resumeReviewService;
    private PaymentNotificationDispatcher dispatcher;
    private PaymentNotificationRequest request;

    @BeforeEach
    void setUp() {
        dispatcher = new PaymentNotificationDispatcher(
                gateway, marketplaceOrderService, membershipOrderService,
                showcasePurchaseService, resumeReviewService);
        request = new PaymentNotificationRequest("serial", "nonce", "timestamp", "signature", "body");
        when(gateway.provider()).thenReturn("wechat");
    }

    @Test
    void verifiedMembershipOrderIsRoutedByPmPrefix() {
        ProviderPaymentResult result = paid("PM123");
        when(gateway.verifyNotification(request)).thenReturn(result);

        dispatcher.dispatch(request);

        verify(membershipOrderService).handleVerifiedProviderNotification(result);
        verifyNoInteractions(marketplaceOrderService, showcasePurchaseService, resumeReviewService);
    }

    @Test
    void verifiedMarketplaceOrderIsRoutedByPrPrefix() {
        ProviderPaymentResult result = paid("PR123");
        when(gateway.verifyNotification(request)).thenReturn(result);

        dispatcher.dispatch(request);

        verify(marketplaceOrderService).handleVerifiedProviderNotification(result);
        verifyNoInteractions(membershipOrderService, showcasePurchaseService, resumeReviewService);
    }

    @Test
    void verifiedResumeReviewOrderIsRoutedByPsPrefix() {
        ProviderPaymentResult result = paid("PS123");
        when(gateway.verifyNotification(request)).thenReturn(result);

        dispatcher.dispatch(request);

        verify(resumeReviewService).handleVerifiedProviderNotification(result);
        verifyNoInteractions(marketplaceOrderService, membershipOrderService, showcasePurchaseService);
    }

    @Test
    void verifiedShowcaseOrderIsRoutedByPoPrefix() {
        ProviderPaymentResult result = paid("PO123");
        when(gateway.verifyNotification(request)).thenReturn(result);

        dispatcher.dispatch(request);

        verify(showcasePurchaseService).handleVerifiedProviderNotification(result);
        verifyNoInteractions(marketplaceOrderService, membershipOrderService, resumeReviewService);
    }

    @Test
    void unknownSignedOrderPrefixIsRejected() {
        when(gateway.verifyNotification(request)).thenReturn(paid("UNKNOWN123"));

        assertThrows(BusinessException.class, () -> dispatcher.dispatch(request));

        verifyNoInteractions(marketplaceOrderService, membershipOrderService,
                showcasePurchaseService, resumeReviewService);
    }

    private ProviderPaymentResult paid(String orderNo) {
        return new ProviderPaymentResult(
                PaymentProviderState.PAID, orderNo, "tx", "app", "merchant",
                "CNY", 6600, LocalDateTime.now());
    }
}
