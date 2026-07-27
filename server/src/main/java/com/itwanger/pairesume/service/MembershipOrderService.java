package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.MembershipOrderDTO;
import com.itwanger.pairesume.payment.ProviderPaymentResult;

public interface MembershipOrderService {
    MembershipOrderDTO createOrder(
            Long userId,
            String idempotencyKey,
            String planCode,
            String couponCode,
            String clientIp
    );

    default MembershipOrderDTO createOrder(
            Long userId,
            String idempotencyKey,
            String couponCode,
            String clientIp
    ) {
        return createOrder(userId, idempotencyKey, "ANNUAL", couponCode, clientIp);
    }

    MembershipOrderDTO getOrder(String orderNo, Long userId);

    MembershipOrderDTO getActiveOrder(Long userId);

    MembershipOrderDTO refreshOrder(String orderNo, Long userId);

    void handleVerifiedProviderNotification(ProviderPaymentResult result);
}
