package com.itwanger.pairesume.payment;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.util.StringUtils;

import java.util.Objects;

@Slf4j
public final class ProviderPaymentResultValidator {
    private ProviderPaymentResultValidator() {
    }

    public static void verifyIdentityAndAmount(
            String expectedOrderNo,
            String orderProvider,
            Integer expectedAmountCents,
            MarketplacePaymentGateway gateway,
            ProviderPaymentResult result
    ) {
        if (result == null) {
            reject(expectedOrderNo, null, "result_missing");
        }
        if (result.state() == null) {
            reject(expectedOrderNo, result, "state_missing");
        }
        if (!Objects.equals(expectedOrderNo, result.orderNo())) {
            reject(expectedOrderNo, result, "order_mismatch");
        }
        if (!Objects.equals(orderProvider, gateway.provider())) {
            reject(expectedOrderNo, result, "provider_mismatch");
        }
        if (!Objects.equals(gateway.expectedAppId(), result.appId())) {
            reject(expectedOrderNo, result, "app_id_mismatch");
        }
        if (!Objects.equals(gateway.expectedMerchantId(), result.merchantId())) {
            reject(expectedOrderNo, result, "merchant_id_mismatch");
        }

        Integer actualAmountCents = result.amountCents();
        if (actualAmountCents == null) {
            if (requiresAmount(result.state())) {
                reject(expectedOrderNo, result, "amount_missing");
            }
            if (StringUtils.hasText(result.currency()) && !"CNY".equals(result.currency())) {
                reject(expectedOrderNo, result, "currency_mismatch");
            }
            return;
        }
        if (!"CNY".equals(result.currency())) {
            reject(expectedOrderNo, result, "currency_mismatch");
        }
        if (!Objects.equals(expectedAmountCents, actualAmountCents)) {
            log.warn("Payment provider result rejected orderNo={}, reason=amount_mismatch, state={}",
                    expectedOrderNo, result.state());
            throw new BusinessException(ResultCode.PAYMENT_AMOUNT_MISMATCH);
        }
    }

    private static boolean requiresAmount(PaymentProviderState state) {
        return state == PaymentProviderState.PAID
                || state == PaymentProviderState.PENDING
                || state == PaymentProviderState.REFUND_PENDING_VERIFICATION
                || state == PaymentProviderState.REFUNDED;
    }

    private static void reject(String expectedOrderNo, ProviderPaymentResult result, String reason) {
        log.warn("Payment provider result rejected orderNo={}, reason={}, state={}",
                expectedOrderNo, reason, result == null ? null : result.state());
        throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
    }
}
