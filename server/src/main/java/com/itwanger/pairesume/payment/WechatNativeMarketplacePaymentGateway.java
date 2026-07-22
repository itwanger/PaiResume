package com.itwanger.pairesume.payment;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.wechat.pay.java.core.Config;
import com.wechat.pay.java.core.RSAAutoCertificateConfig;
import com.wechat.pay.java.core.exception.ServiceException;
import com.wechat.pay.java.core.notification.NotificationParser;
import com.wechat.pay.java.core.notification.RequestParam;
import com.wechat.pay.java.service.payments.model.Transaction;
import com.wechat.pay.java.service.payments.model.TransactionAmount;
import com.wechat.pay.java.service.payments.nativepay.NativePayService;
import com.wechat.pay.java.service.payments.nativepay.model.Amount;
import com.wechat.pay.java.service.payments.nativepay.model.CloseOrderRequest;
import com.wechat.pay.java.service.payments.nativepay.model.PrepayRequest;
import com.wechat.pay.java.service.payments.nativepay.model.PrepayResponse;
import com.wechat.pay.java.service.payments.nativepay.model.QueryOrderByOutTradeNoRequest;
import com.wechat.pay.java.service.payments.nativepay.model.SceneInfo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

@Slf4j
@Component
@ConditionalOnProperty(prefix = "app.payment", name = "provider", havingValue = "wechat-native")
public class WechatNativeMarketplacePaymentGateway implements MarketplacePaymentGateway {
    private static final ZoneId PAYMENT_ZONE = ZoneId.of("Asia/Shanghai");

    private final MarketplacePaymentProperties properties;
    private final NativePayService nativePayService;
    private final NotificationParser notificationParser;

    public WechatNativeMarketplacePaymentGateway(MarketplacePaymentProperties properties,
                                                  ResourceLoader resourceLoader) {
        this.properties = properties;
        MarketplacePaymentProperties.Wechat wechat = properties.getWechat();
        String privateKey = readPrivateKey(wechat.getPrivateKey(), resourceLoader);
        Config config = new RSAAutoCertificateConfig.Builder()
                .merchantId(require(wechat.getMerchantId(), "WECHAT_PAY_MERCHANT_ID"))
                .privateKey(privateKey)
                .merchantSerialNumber(require(wechat.getMerchantSerialNumber(), "WECHAT_PAY_MERCHANT_SERIAL_NUMBER"))
                .apiV3Key(require(wechat.getApiV3Key(), "WECHAT_PAY_API_V3_KEY"))
                .build();
        this.nativePayService = new NativePayService.Builder().config(config).build();
        this.notificationParser = new NotificationParser((RSAAutoCertificateConfig) config);
    }

    WechatNativeMarketplacePaymentGateway(MarketplacePaymentProperties properties,
                                          NativePayService nativePayService,
                                          NotificationParser notificationParser) {
        this.properties = properties;
        this.nativePayService = nativePayService;
        this.notificationParser = notificationParser;
    }

    @Override
    public String provider() {
        return "wechat";
    }

    @Override
    public String expectedAppId() {
        return properties.getWechat().getAppId();
    }

    @Override
    public String expectedMerchantId() {
        return properties.getWechat().getMerchantId();
    }

    @Override
    public PaymentPrepayResult createNativeOrder(PaymentPrepayRequest command) {
        MarketplacePaymentProperties.Wechat wechat = properties.getWechat();
        PrepayRequest request = new PrepayRequest();
        request.setAppid(wechat.getAppId());
        request.setMchid(wechat.getMerchantId());
        request.setDescription(command.description());
        request.setOutTradeNo(command.orderNo());
        request.setNotifyUrl(wechat.getNotifyUrl());
        request.setTimeExpire(command.expiresAt().atZone(PAYMENT_ZONE)
                .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));

        Amount amount = new Amount();
        amount.setTotal(command.amountCents());
        amount.setCurrency("CNY");
        request.setAmount(amount);

        SceneInfo sceneInfo = new SceneInfo();
        sceneInfo.setPayerClientIp(command.clientIp());
        request.setSceneInfo(sceneInfo);

        log.info("Creating WeChat Native order orderNo={}, amountCents={}",
                command.orderNo(), command.amountCents());
        PrepayResponse response = nativePayService.prepay(request);
        if (response == null || !StringUtils.hasText(response.getCodeUrl())) {
            throw new IllegalStateException("WeChat Native prepay returned no code URL");
        }
        log.info("WeChat Native prepay ready orderNo={}", command.orderNo());
        return new PaymentPrepayResult(provider(), null, response.getCodeUrl(), command.expiresAt());
    }

    @Override
    public ProviderPaymentResult queryOrder(String orderNo) {
        QueryOrderByOutTradeNoRequest request = new QueryOrderByOutTradeNoRequest();
        request.setMchid(properties.getWechat().getMerchantId());
        request.setOutTradeNo(orderNo);
        try {
            return toResult(nativePayService.queryOrderByOutTradeNo(request));
        } catch (ServiceException exception) {
            if ("ORDER_NOT_EXIST".equals(exception.getErrorCode())) {
                log.info("WeChat Native query confirmed missing order orderNo={}", orderNo);
                return new ProviderPaymentResult(
                        PaymentProviderState.FAILED,
                        orderNo,
                        null,
                        expectedAppId(),
                        expectedMerchantId(),
                        "CNY",
                        null,
                        null
                );
            }
            throw exception;
        }
    }

    @Override
    public void closeOrder(String orderNo) {
        CloseOrderRequest request = new CloseOrderRequest();
        request.setMchid(properties.getWechat().getMerchantId());
        request.setOutTradeNo(orderNo);
        nativePayService.closeOrder(request);
        log.info("WeChat Native order close requested orderNo={}", orderNo);
    }

    @Override
    public ProviderPaymentResult verifyNotification(PaymentNotificationRequest request) {
        try {
            RequestParam requestParam = new RequestParam.Builder()
                    .serialNumber(request.serialNumber())
                    .nonce(request.nonce())
                    .timestamp(request.timestamp())
                    .signature(request.signature())
                    .body(request.body())
                    .build();
            return toResult(notificationParser.parse(requestParam, Transaction.class));
        } catch (Exception exception) {
            log.warn("Rejected invalid WeChat payment notification: {}", exception.getClass().getSimpleName());
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }
    }

    private ProviderPaymentResult toResult(Transaction transaction) {
        if (transaction == null || !StringUtils.hasText(transaction.getOutTradeNo())) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }
        TransactionAmount amount = transaction.getAmount();
        LocalDateTime paidAt = StringUtils.hasText(transaction.getSuccessTime())
                ? OffsetDateTime.parse(transaction.getSuccessTime())
                        .atZoneSameInstant(PAYMENT_ZONE)
                        .toLocalDateTime()
                : null;
        return new ProviderPaymentResult(
                toProviderState(transaction.getTradeState()),
                transaction.getOutTradeNo(),
                transaction.getTransactionId(),
                transaction.getAppid(),
                transaction.getMchid(),
                amount == null ? null : amount.getCurrency(),
                amount == null ? null : amount.getTotal(),
                paidAt
        );
    }

    private PaymentProviderState toProviderState(Transaction.TradeStateEnum state) {
        if (state == null) {
            throw new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID);
        }
        return switch (state) {
            case SUCCESS -> PaymentProviderState.PAID;
            case NOTPAY, USERPAYING -> PaymentProviderState.PENDING;
            case CLOSED, REVOKED -> PaymentProviderState.CLOSED;
            // Transaction query only says the payment has entered a refund
            // flow. It does not prove a successful full-amount refund. Keep
            // access/accounting frozen for review; only a dedicated verified
            // refund result may produce REFUNDED.
            case REFUND -> PaymentProviderState.REFUND_PENDING_VERIFICATION;
            default -> PaymentProviderState.FAILED;
        };
    }

    private String readPrivateKey(String configuredValue, ResourceLoader resourceLoader) {
        String value = require(configuredValue, "WECHAT_PAY_PRIVATE_KEY").trim();
        if (value.contains("-----BEGIN PRIVATE KEY-----")) {
            return value.replace("\\n", "\n");
        }
        try {
            if (value.startsWith("classpath:") || value.startsWith("file:")) {
                return new String(resourceLoader.getResource(value).getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            }
            Path path = Path.of(value);
            if (Files.isRegularFile(path)) {
                return Files.readString(path, StandardCharsets.UTF_8);
            }
        } catch (IOException | RuntimeException ignored) {
            // Try the base64 representation next without exposing the configured value.
        }
        try {
            String decoded = new String(Base64.getDecoder().decode(value), StandardCharsets.UTF_8);
            if (decoded.contains("-----BEGIN PRIVATE KEY-----")) {
                return decoded;
            }
        } catch (IllegalArgumentException ignored) {
            // Report a generic configuration failure below.
        }
        throw new IllegalStateException("WECHAT_PAY_PRIVATE_KEY must be PEM, base64 PEM, or a readable resource path");
    }

    private String require(String value, String name) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalStateException(name + " is required when PAYMENT_PROVIDER=wechat-native");
        }
        return value.trim();
    }
}
