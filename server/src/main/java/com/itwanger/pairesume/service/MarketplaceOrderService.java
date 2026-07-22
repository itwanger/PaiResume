package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.MarketplaceOrderDTO;
import com.itwanger.pairesume.dto.MarketplacePaymentReviewDTO;
import com.itwanger.pairesume.payment.PaymentNotificationRequest;

public interface MarketplaceOrderService {
    MarketplaceOrderDTO createOrder(String listingSlug, Long buyerUserId, boolean admin,
                                    String idempotencyKey, String clientIp);

    MarketplaceOrderDTO getOrder(String orderNo, Long userId, boolean admin);

    MarketplaceOrderDTO refreshOrder(String orderNo, Long userId, boolean admin);

    void handleWechatNotification(PaymentNotificationRequest request);

    java.util.List<MarketplacePaymentReviewDTO> listPaymentReviews(String status);

    java.util.List<MarketplacePaymentReviewDTO> listOutstandingCloseWork();

    MarketplacePaymentReviewDTO getPaymentReview(String orderNo);

    MarketplacePaymentReviewDTO confirmManualRefund(String orderNo, Long adminUserId,
                                                     String refundReference, String note);
}
