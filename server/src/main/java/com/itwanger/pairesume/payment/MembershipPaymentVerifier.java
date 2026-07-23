package com.itwanger.pairesume.payment;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.entity.MembershipPaymentOrder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Objects;

@Component
@RequiredArgsConstructor
public class MembershipPaymentVerifier {
    private final MarketplacePaymentGateway gateway;

    public void verify(MembershipPaymentOrder order, ProviderPaymentResult result) {
        if (result == null
                || !Objects.equals(order.getOrderNo(), result.orderNo())
                || !Objects.equals(order.getProvider(), gateway.provider())
                || !Objects.equals(gateway.expectedAppId(), result.appId())
                || !Objects.equals(gateway.expectedMerchantId(), result.merchantId())
                || !"CNY".equals(result.currency())) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }
        if (result.amountCents() == null) {
            if (result.state() == PaymentProviderState.PAID
                    || result.state() == PaymentProviderState.PENDING
                    || result.state() == PaymentProviderState.REFUND_PENDING_VERIFICATION
                    || result.state() == PaymentProviderState.REFUNDED) {
                throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
            }
        } else if (!Objects.equals(order.getPayableAmountCents(), result.amountCents())) {
            throw new BusinessException(ResultCode.PAYMENT_AMOUNT_MISMATCH);
        }
        boolean transactionRequired = result.state() == PaymentProviderState.PAID
                || result.state() == PaymentProviderState.REFUND_PENDING_VERIFICATION
                || result.state() == PaymentProviderState.REFUNDED;
        if (transactionRequired && !StringUtils.hasText(result.transactionId())) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }
        if (result.state() == PaymentProviderState.PAID && result.paidAt() == null) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }
        if (StringUtils.hasText(order.getProviderTransactionId())
                && StringUtils.hasText(result.transactionId())
                && !Objects.equals(order.getProviderTransactionId(), result.transactionId())) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }
    }
}
