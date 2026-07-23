package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.payment.PaymentNotificationRequest;
import com.itwanger.pairesume.service.impl.PaymentNotificationDispatcher;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/public/payments/wechat")
@RequiredArgsConstructor
public class MarketplacePaymentNotificationController {
    private static final int MAX_NOTIFICATION_BYTES = 64 * 1024;

    private final PaymentNotificationDispatcher notificationDispatcher;

    @PostMapping("/notify")
    public ResponseEntity<Void> notify(
            @RequestHeader("Wechatpay-Serial") String serialNumber,
            @RequestHeader("Wechatpay-Nonce") String nonce,
            @RequestHeader("Wechatpay-Timestamp") String timestamp,
            @RequestHeader("Wechatpay-Signature") String signature,
            @RequestHeader(value = HttpHeaders.CONTENT_LENGTH, required = false) Long contentLength,
            @RequestBody String body
    ) {
        if ((contentLength != null && contentLength > MAX_NOTIFICATION_BYTES)
                || body.getBytes(StandardCharsets.UTF_8).length > MAX_NOTIFICATION_BYTES) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }
        notificationDispatcher.dispatch(new PaymentNotificationRequest(
                serialNumber, nonce, timestamp, signature, body));
        return ResponseEntity.noContent().build();
    }
}
