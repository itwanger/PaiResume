package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.ShowcasePurchaseOrderDTO;
import com.itwanger.pairesume.payment.ProviderPaymentResult;

public interface ShowcasePurchaseService {
    ShowcasePurchaseOrderDTO createOrder(String slug, String purchaseToken,
                                         String idempotencyKey, String clientIp);

    ShowcasePurchaseOrderDTO getOrder(String orderNo, String purchaseToken);

    ShowcasePurchaseOrderDTO getLatestOrder(String slug, String purchaseToken);

    ShowcasePurchaseOrderDTO refreshOrder(String orderNo, String purchaseToken);

    boolean isUnlocked(Long showcaseId, String purchaseToken);

    boolean isPaymentEnabled();

    void handleVerifiedProviderNotification(ProviderPaymentResult result);
}
