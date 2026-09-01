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
        ProviderPaymentResultValidator.verifyIdentityAndAmount(
                order.getOrderNo(), order.getProvider(), order.getPayableAmountCents(), gateway, result);
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
