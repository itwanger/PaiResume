package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.entity.ResumeShowcase;
import com.itwanger.pairesume.entity.ShowcasePurchaseOrder;
import com.itwanger.pairesume.mapper.ResumeShowcaseMapper;
import com.itwanger.pairesume.mapper.ShowcasePurchaseOrderMapper;
import com.itwanger.pairesume.payment.MarketplacePaymentGateway;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.payment.PaymentPrepayResult;
import com.itwanger.pairesume.payment.PaymentProviderState;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import com.itwanger.pairesume.payment.QrCodeDataUrlGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShowcasePurchaseServiceImplTest {
    private static final String TOKEN = "0123456789abcdef0123456789abcdef0123456789a";

    @Mock private ResumeShowcaseMapper showcaseMapper;
    @Mock private ShowcasePurchaseOrderMapper orderMapper;
    @Mock private MarketplacePaymentGateway paymentGateway;
    @Mock private QrCodeDataUrlGenerator qrCodeGenerator;

    private MarketplacePaymentProperties properties;
    private ShowcasePurchaseServiceImpl service;

    @BeforeEach
    void setUp() {
        properties = new MarketplacePaymentProperties();
        properties.setProvider("mock");
        properties.setOrderExpireMinutes(15);
        service = new ShowcasePurchaseServiceImpl(
                showcaseMapper, orderMapper, paymentGateway, properties, qrCodeGenerator);
    }

    @Test
    void paymentAvailabilityFollowsTheConfiguredProvider() {
        when(paymentGateway.provider()).thenReturn("mock", "disabled");

        assertTrue(service.isPaymentEnabled());
        assertFalse(service.isPaymentEnabled());
    }

    @Test
    void anonymousOrderUsesAdminShowcasePriceAndStoresOnlyTokenHash() {
        ResumeShowcase showcase = paidShowcase();
        when(showcaseMapper.selectOne(any())).thenReturn(showcase);
        when(paymentGateway.provider()).thenReturn("mock");
        when(paymentGateway.createNativeOrder(any())).thenAnswer(invocation -> {
            var request = invocation.getArgument(0, com.itwanger.pairesume.payment.PaymentPrepayRequest.class);
            return new PaymentPrepayResult("mock", "prepay", "mock://pay", request.expiresAt());
        });
        when(qrCodeGenerator.generate("mock://pay")).thenReturn("data:image/png;base64,AA");
        when(showcaseMapper.selectById(11L)).thenReturn(showcase);

        var result = service.createOrder("featured-65", TOKEN, "request-1", "127.0.0.1");

        ArgumentCaptor<ShowcasePurchaseOrder> orderCaptor = ArgumentCaptor.forClass(ShowcasePurchaseOrder.class);
        org.mockito.Mockito.verify(orderMapper).insert(orderCaptor.capture());
        ShowcasePurchaseOrder stored = orderCaptor.getValue();
        assertEquals(6600, stored.getAmountCents());
        assertEquals(64, stored.getPurchaseTokenHash().length());
        assertNotEquals(TOKEN, stored.getPurchaseTokenHash());
        assertTrue(stored.getOrderNo().startsWith("PO"));
        assertEquals(32, stored.getOrderNo().length());
        assertEquals("PENDING", result.getOrderStatus());
        assertEquals(6600, result.getAmountCents());
        assertFalse(result.getUnlocked());
    }

    @Test
    void paidProviderResultUnlocksOnlyTheMatchingBrowserCredential() {
        ShowcasePurchaseOrder order = pendingOrder();
        when(orderMapper.selectByOrderNo(any())).thenReturn(order);
        when(paymentGateway.provider()).thenReturn("mock");
        when(paymentGateway.expectedAppId()).thenReturn("mock-app");
        when(paymentGateway.expectedMerchantId()).thenReturn("mock-merchant");
        when(paymentGateway.queryOrder(order.getOrderNo())).thenReturn(new ProviderPaymentResult(
                PaymentProviderState.PAID,
                order.getOrderNo(),
                "transaction-1",
                "mock-app",
                "mock-merchant",
                "CNY",
                6600,
                LocalDateTime.now()
        ));
        when(showcaseMapper.selectById(11L)).thenReturn(paidShowcase());

        var result = service.refreshOrder(order.getOrderNo(), TOKEN);

        assertEquals("PAID", result.getOrderStatus());
        assertTrue(result.getUnlocked());
        assertEquals("transaction-1", order.getProviderTransactionId());
        assertEquals(null, order.getActiveOrderKey());
    }

    private ResumeShowcase paidShowcase() {
        ResumeShowcase showcase = new ResumeShowcase();
        showcase.setId(11L);
        showcase.setSlug("featured-65");
        showcase.setPublishStatus("PUBLISHED");
        showcase.setAccessType("PAID");
        showcase.setPriceCents(6600);
        return showcase;
    }

    private ShowcasePurchaseOrder pendingOrder() {
        ShowcasePurchaseOrder order = new ShowcasePurchaseOrder();
        order.setId(20L);
        order.setOrderNo("PO123");
        order.setShowcaseId(11L);
        order.setPurchaseTokenHash("263b9741bfc84598b8f5688c5481887c8493d40b0b557de2f2f9b0329139c5db");
        order.setActiveOrderKey("11:hash");
        order.setAmountCents(6600);
        order.setCurrency("CNY");
        order.setProvider("mock");
        order.setPayChannel("MOCK_NATIVE");
        order.setOrderStatus("PENDING");
        order.setExpiresAt(LocalDateTime.now().plusMinutes(10));
        return order;
    }
}
