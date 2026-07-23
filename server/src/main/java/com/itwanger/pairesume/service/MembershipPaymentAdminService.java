package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.MarketplacePageDTO;
import com.itwanger.pairesume.dto.MembershipPaymentAdminOrderDTO;
import com.itwanger.pairesume.dto.MembershipPaymentAdminSummaryDTO;

public interface MembershipPaymentAdminService {
    MarketplacePageDTO<MembershipPaymentAdminOrderDTO> listOrders(
            int page, int size, String orderStatus, String reviewStatus);

    MembershipPaymentAdminOrderDTO getOrder(String orderNo);

    MembershipPaymentAdminOrderDTO startRefund(
            String orderNo, Long adminUserId, String reason, String refundReference);

    MembershipPaymentAdminOrderDTO confirmRefunded(
            String orderNo, Long adminUserId, String reason, String refundReference);

    MembershipPaymentAdminOrderDTO rejectRefund(
            String orderNo, Long adminUserId, String reason);

    MembershipPaymentAdminOrderDTO closeReview(
            String orderNo, Long adminUserId, String reason);

    MembershipPaymentAdminSummaryDTO summary();
}
