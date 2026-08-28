package com.itwanger.pairesume.payment;

import com.itwanger.pairesume.service.WechatPayConfigService;
import com.wechat.pay.java.core.exception.ServiceException;
import com.wechat.pay.java.service.payments.nativepay.NativePayService;
import com.wechat.pay.java.service.payments.model.Transaction;
import com.wechat.pay.java.service.payments.model.TransactionAmount;
import com.wechat.pay.java.service.payments.nativepay.model.PrepayRequest;
import com.wechat.pay.java.service.payments.nativepay.model.PrepayResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.core.io.ResourceLoader;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WechatNativeMarketplacePaymentGatewayTest {

    @Test
    void rejectsOversizedOrderNumberBeforeInitializingProviderClient() {
        MarketplacePaymentProperties properties = new MarketplacePaymentProperties();
        WechatNativeMarketplacePaymentGateway gateway =
                new WechatNativeMarketplacePaymentGateway(
                        properties, (NativePayService) null, null);
        PaymentPrepayRequest request = new PaymentPrepayRequest(
                "PO" + "a".repeat(32), "description", 600,
                "127.0.0.1", LocalDateTime.now().plusMinutes(15));

        assertThrows(IllegalArgumentException.class, () -> gateway.createNativeOrder(request));
    }

    @Test
    void providerFollowsAdminConfigurationWithoutRestart() {
        WechatPayConfigService configService = mock(WechatPayConfigService.class);
        WechatNativeMarketplacePaymentGateway gateway = new WechatNativeMarketplacePaymentGateway(
                new MarketplacePaymentProperties(), mock(ResourceLoader.class), configService);
        when(configService.isEnabled()).thenReturn(false, true);

        assertEquals("disabled", gateway.provider());
        assertEquals("wechat", gateway.provider());
    }

    @Test
    void formatsWechatExpiryAtWholeSecondPrecision() {
        NativePayService nativePayService = mock(NativePayService.class);
        PrepayResponse response = mock(PrepayResponse.class);
        when(response.getCodeUrl()).thenReturn("weixin://wxpay/test");
        when(nativePayService.prepay(any())).thenReturn(response);
        LocalDateTime expiresAt = LocalDateTime.of(2026, 8, 28, 18, 30, 45, 123_456_789);

        gateway(nativePayService).createNativeOrder(new PaymentPrepayRequest(
                "PO" + "a".repeat(30), "description", 600, "127.0.0.1", expiresAt));

        ArgumentCaptor<PrepayRequest> requestCaptor = ArgumentCaptor.forClass(PrepayRequest.class);
        verify(nativePayService).prepay(requestCaptor.capture());
        assertEquals("2026-08-28T18:30:45+08:00", requestCaptor.getValue().getTimeExpire());
    }

    @Test
    void explicitOrderNotExistBecomesSafeFailedState() {
        NativePayService nativePayService = mock(NativePayService.class);
        ServiceException notFound = mock(ServiceException.class);
        when(notFound.getErrorCode()).thenReturn("ORDER_NOT_EXIST");
        when(notFound.getHttpStatusCode()).thenReturn(404);
        when(nativePayService.queryOrderByOutTradeNo(any())).thenThrow(notFound);

        ProviderPaymentResult result = gateway(nativePayService).queryOrder("PR-missing");

        assertEquals(PaymentProviderState.FAILED, result.state());
        assertEquals("PR-missing", result.orderNo());
    }

    @Test
    void ambiguousProviderFailureRemainsUnknownToCaller() {
        NativePayService nativePayService = mock(NativePayService.class);
        ServiceException serverError = mock(ServiceException.class);
        when(serverError.getErrorCode()).thenReturn("SYSTEM_ERROR");
        when(serverError.getHttpStatusCode()).thenReturn(500);
        when(nativePayService.queryOrderByOutTradeNo(any())).thenThrow(serverError);

        assertThrows(ServiceException.class, () -> gateway(nativePayService).queryOrder("PR-unknown"));
    }

    @Test
    void bareHttp404WithoutWechatOrderNotExistCodeRemainsUnknown() {
        NativePayService nativePayService = mock(NativePayService.class);
        ServiceException proxyNotFound = mock(ServiceException.class);
        when(proxyNotFound.getErrorCode()).thenReturn(null);
        when(proxyNotFound.getHttpStatusCode()).thenReturn(404);
        when(nativePayService.queryOrderByOutTradeNo(any())).thenThrow(proxyNotFound);

        assertThrows(ServiceException.class,
                () -> gateway(nativePayService).queryOrder("PR-proxy-404"));
    }

    @Test
    void genericTransactionRefundStateDoesNotPretendFullRefundSucceeded() {
        NativePayService nativePayService = mock(NativePayService.class);
        Transaction transaction = mock(Transaction.class);
        TransactionAmount amount = mock(TransactionAmount.class);
        when(transaction.getOutTradeNo()).thenReturn("PR-refund");
        when(transaction.getTradeState()).thenReturn(Transaction.TradeStateEnum.REFUND);
        when(transaction.getTransactionId()).thenReturn("TX-1");
        when(transaction.getAppid()).thenReturn("app-id");
        when(transaction.getMchid()).thenReturn("merchant-id");
        when(transaction.getAmount()).thenReturn(amount);
        when(amount.getCurrency()).thenReturn("CNY");
        when(amount.getTotal()).thenReturn(100);
        when(nativePayService.queryOrderByOutTradeNo(any())).thenReturn(transaction);

        ProviderPaymentResult result = gateway(nativePayService).queryOrder("PR-refund");

        assertEquals(PaymentProviderState.REFUND_PENDING_VERIFICATION, result.state());
    }

    private WechatNativeMarketplacePaymentGateway gateway(NativePayService service) {
        MarketplacePaymentProperties properties = new MarketplacePaymentProperties();
        properties.getWechat().setAppId("app-id");
        properties.getWechat().setMerchantId("merchant-id");
        return new WechatNativeMarketplacePaymentGateway(properties, service, null);
    }
}
