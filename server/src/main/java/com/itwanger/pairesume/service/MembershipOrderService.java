package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.MembershipOrderDTO;
import com.itwanger.pairesume.payment.ProviderPaymentResult;

public interface MembershipOrderService {
    MembershipOrderDTO createOrder(Long userId, String idempotencyKey, String couponCode, String clientIp);

    MembershipOrderDTO getOrder(String orderNo, Long userId);

    MembershipOrderDTO refreshOrder(String orderNo, Long userId);

    void handleVerifiedProviderNotification(ProviderPaymentResult result);
}
