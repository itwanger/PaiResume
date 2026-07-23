package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.payment.MarketplacePaymentGateway;
import com.itwanger.pairesume.payment.PaymentNotificationRequest;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import com.itwanger.pairesume.service.MarketplaceOrderService;
import com.itwanger.pairesume.service.MembershipOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class PaymentNotificationDispatcher {
    private final MarketplacePaymentGateway paymentGateway;
    private final MarketplaceOrderService marketplaceOrderService;
    private final MembershipOrderService membershipOrderService;
    private final com.itwanger.pairesume.service.ResumeReviewService resumeReviewService;

    public void dispatch(PaymentNotificationRequest request) {
        if (!"wechat".equals(paymentGateway.provider())) {
            throw new BusinessException(ResultCode.PAYMENT_NOT_ENABLED);
        }
        // The order prefix is inspected only after the SDK has verified the
        // WeChat signature and decrypted the notification body.
        ProviderPaymentResult result = paymentGateway.verifyNotification(request);
        if (result == null || !StringUtils.hasText(result.orderNo())) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }
        if (result.orderNo().startsWith("PR")) {
            marketplaceOrderService.handleVerifiedProviderNotification(result);
            return;
        }
        if (result.orderNo().startsWith("PM")) {
            membershipOrderService.handleVerifiedProviderNotification(result);
            return;
        }
        if (result.orderNo().startsWith("PS")) {
            resumeReviewService.handleVerifiedProviderNotification(result);
            return;
        }
        throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
    }
}
